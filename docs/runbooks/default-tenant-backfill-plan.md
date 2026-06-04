# Default Tenant Backfill Plan

`NC-E1-03` defines the expand/contract plan for moving the current single-tenant
schema toward organization-owned rows and enforceable RLS. It is a planning
slice only: it does not add schema migrations, tenant columns, seed data, RLS
policies, or application callsite wiring.

## Goal

Before any tenant column is added, the repo needs a deterministic migration
contract for existing data. The plan must answer:

- which current rows become tenant-owned
- which rows stay platform-owned
- which rows need branch, facility, location, or jurisdiction scope
- how the default single-tenant organization and facility are created
- what evidence is required before non-null constraints or production RLS

The tenant key remains `organization_id`. Branch, facility, location, and
jurisdiction are resource, authorization, and compliance scopes on top of that
tenant boundary.

## Non-Scope

This plan does not authorize:

- `organizations`, `facilities`, `branches`, memberships, or jurisdiction tables
- tenant columns on any table
- production RLS policies
- `withTenantContext` callsite wiring
- PHI read audit, field encryption, consent, retention, BAA/DPA, or vendor policy
- regional database routing or physical tenant isolation
- direct-to-consumer tenant ownership

## Current Table Classification

| Current table | Category | Later ownership rule |
|---|---|---|
| `service_requests` | tenant-owned, care-site scoped | Add `organization_id`; add facility/location ownership before non-null. Existing rows backfill to default organization and default facility. |
| `patients` | tenant-owned PHI | Add `organization_id`; backfill to default organization. Validate whether patient profile rows need facility scope through linked requests before enforcing. |
| `assignments` | tenant-owned through request, nurse relationship | Add `organization_id` before contract so RLS does not depend on per-row joins. Populate from `service_requests.organization_id` and enforce consistency with a composite relationship such as `(organization_id, request_id) -> service_requests(organization_id, id)`. |
| `visits` | tenant-owned PHI through assignment | Backfill through the reviewed chain `visits -> assignments -> service_requests.organization_id`; facility scope follows the request or assignment. |
| `service_request_events` | tenant-owned audit/workflow evidence | Backfill from `service_requests` only after `meta` payloads are classified for PHI. Any incomplete PHI classification blocks ownership-column expand and backfill for this table. |
| `payment_authorizations` | tenant-owned patient payment authorization | Backfill from `service_requests`; keep provider references non-PHI and tenant-scoped. |
| `nurse_payouts` | mixed tenant/platform financial evidence | Backfill tenant context from `service_requests`, but do not assume nurse earnings views are tenant-only; platform ledger/export design must be explicit before enforce. |
| `referral_partners` | platform-scoped CRM seed candidate | Existing rows can inform default or future organization records, but do not become the tenant table directly. The current `service_requests.referral_partner_id -> users.id` relationship must be reviewed and re-targeted before referral partners can carry tenant scope. |
| `admin_audit_logs` | mixed tenant/platform audit | Defer tenant backfill until a concrete audit scope discriminator is designed. Acceptable future designs include separate tenant/platform audit tables or explicit scope plus nullable organization columns with platform-only constraints. |
| `nurses` | platform supply identity plus tenant-context risk | Keep platform supply identity separate from tenant demand. Current columns that can remain platform-scoped are `id`, `user_id`, supply lifecycle `status`, `is_available`, and coarse non-tenant routing profile fields. Credentialing, license details, consent, assignment participation, PHI exposure, tenant audit evidence, and tenant/facility eligibility move to explicit tenant/facility relationship rows later. Current free-text `license_jurisdiction` must be normalized before nurse rows participate in structured jurisdiction backfill. |
| `nurse_locations` | platform routing with jurisdiction/facility risk | Treat as platform supply routing until tenant-specific availability/commitment is modeled. Location access must not expose tenant PHI. |
| `service_areas` | operating market scope | Add jurisdiction/region semantics before using service areas as facility or tenant ownership. |
| `users` | platform identity bridge | Remains platform identity. Tenant membership and role scope must be separate. |
| `auth_users`, `auth_sessions`, `auth_accounts`, `auth_verifications` | auth provider state | Do not tenant-own Better-Auth tables; tenant access derives through domain identity and memberships. |

## Default Bootstrap Contract

Later schema work must create deterministic ownership records before adding
domain-table ownership columns:

1. A data audit proves the current database is truly single-tenant for PHI and
   tenant-owned workflow data. If referral partners, care providers, facilities,
   operators, exports, or support processes already encode pseudo-tenants, the
   default organization backfill must pause instead of co-mingling those rows.
2. `organizations` table exists.
3. `facilities` or `branches` table exists and belongs to exactly one
   organization.
4. A default organization seed exists with a stable identifier.
5. A default facility/location seed exists with a stable identifier and belongs
   to the default organization.
6. The default facility has an explicit operational jurisdiction, including at
   minimum country and state/region where nurse licensing, labor, privacy, or
   reimbursement rules depend on it.
7. Default seed records have deletion protection, such as restrictive foreign
   keys, guarded admin operations, or a migration-level invariant that prevents
   accidental deletion of the default organization/facility while legacy rows
   depend on them.

The default seed path must be idempotent. Running it twice must not create
duplicate organizations, facilities, or jurisdiction records. The later
implementation slice must add either a script command such as
`pnpm tenant:seed:verify` or a focused database test that runs the seed twice in
one clean database and asserts stable row counts plus stable seed identifiers.

## Required Data Audit

The implementation slice that opens the default organization/facility bootstrap
must own this audit and include the results in its PR. The accountable owner is
the schema/backfill slice owner, with review from platform/database and privacy
reviewers.

The audit passes only when it records:

- row counts for each table that will receive tenant ownership
- distinct values and relationship counts for existing referral, care-site,
  operator, service-area, and payment/export signals that could encode separate
  organizations
- orphan checks for PHI-bearing relationship chains, including
  `visits -> assignments -> service_requests`,
  `service_request_events -> service_requests`, and
  `payment_authorizations -> service_requests`
- a written decision that all existing tenant-owned PHI/workflow rows can map to
  one default organization and default facility

If the audit finds pseudo-tenants or orphaned PHI-bearing relationship rows, the
default backfill must stop. The contingency is a separate mapping/reconciliation
slice that either creates multiple explicit organizations, repairs or archives
orphaned rows with audit evidence, or records a product/legal decision that the
affected rows are excluded from tenant-owned production data.

## Required PHI Classification

The schema/backfill slice owner also owns `service_request_events.meta`
classification before that table enters expand/backfill. The privacy reviewer
must sign off on the classification evidence.

The classification passes only when it records:

- every current `service_request_events.type` value that writes `meta`
- every known key shape stored in `meta`
- whether each key is PHI, operational metadata, financial evidence, or
  platform-only audit context
- the masking, migration, or exclusion decision for any PHI-bearing key before
  ownership backfill

If classification cannot be completed in the bootstrap/backfill PR, later schema
work must exclude `service_request_events` from expand/backfill until a separate
classification slice lands.

## Expand/Contract Sequence

1. **Plan and classify.** This runbook is the gate for the current schema.
2. **Bootstrap ownership records.** Add organization, facility/location, and
   jurisdiction seed support in a later migration slice.
3. **Expand nullable columns.** Add nullable `organization_id` and care-site
   scope columns with indexes and foreign keys that can target the default seed
   records. Production index creation must use non-blocking patterns such as
   `CREATE INDEX CONCURRENTLY` where the selected migration tool supports it.
4. **Dual-write defaults for new rows.** Before bulk backfill begins, application
   writes for tenant-owned tables must populate the default organization and
   facility for newly inserted rows. Otherwise new `NULL` ownership values can
   appear while older chunks are being backfilled.
5. **Backfill.** Populate existing single-tenant rows from deterministic default
   organization and facility records in bounded chunks, for example 5,000 rows
   per transaction unless production row counts justify a smaller limit.
   Each chunk must use explicit lock and statement timeouts selected for the
   production database.
   Relationship-owned rows backfill from their parent request or assignment.
   `visits` must use `visits -> assignments -> service_requests` before update.
   Unmappable row IDs must be logged to a reviewed reconciliation artifact
   instead of being silently skipped.
6. **Observe.** Keep production allow behavior, but emit evidence for missing
   tenant scope across application and non-application database access.
7. **Staging restrictive-first.** Enable enforcing RLS in CI/staging with at
   least two tenants and run tenant isolation abuse tests.
8. **Contract.** Make ownership columns non-null only after telemetry is zero
   for at least 14 days of representative production traffic, out-of-band access
   is covered, and staging restrictive tests are green.
9. **Enforce.** Enable production RLS only after startup role assertion, pooler
   cleanup behavior, rollback procedure, and audit evidence are verified.

Postgres does not provide native "log-but-allow" RLS. Observe-before-enforce is
therefore an application and operations mechanism, not a permissive RLS policy
claim.

## Callsite And Pooler Constraints

Later tenant-context slices must use the existing transaction-local tenant
context mechanism. Callers must select the correct database handle first, then
pass it to `withTenantContext(database, organizationId, callback)` or an
equivalent helper that opens the transaction and sets the tenant GUC with
`set_config(..., true)`. Helper functions should receive the scoped transaction
or selected database handle instead of importing the global database client.

Do not rely on session-level GUC state, session-level `RESET`, or connection
pooler stickiness for tenant isolation. Pooler validation must prove tenant
context is cleared between transactions and between consecutive requests that
reuse the same underlying connection.

`withTenantContext` rejects nested tenant contexts. Later callsite migration
must account for re-entrancy by passing the existing transaction through helper,
background-job, instrumentation, export, and audit paths instead of wrapping
already-scoped work in another tenant context.

## Observe-Before-Enforce Evidence

Application-layer tenant telemetry is required but insufficient by itself.
Before any non-null or production-enforce step, the rollout evidence must
satisfy all of these checks:

- inventory every known database access path, including web/API, background
  jobs, scripts, support/operator SQL, analytics, exports, BI tools, read
  replicas, migrations, and seeds
- record each path as tenant-scoped, platform-scoped, blocked, or retired
- show structured application telemetry with zero tenant-owned unscoped query
  violations for the selected observation window
- review out-of-band access with query logs, `pg_stat_statements`, database
  audit evidence, or a documented platform-only allowlist
- classify background jobs, analytics, exports, payout flows, and support paths
  before they touch tenant-owned PHI or financial evidence
- prove transaction-local tenant context cleanup under the deployed connection
  pooler
- wire `assertRlsConnectionRoleReady` into startup, health, or migration-runner
  checks before any production-enforce step

`assertRlsConnectionRoleReady` already exists in
`packages/database/src/rls-role-assertion.ts`; later enforce work must wire that
implementation into deployed startup, health, or migration-runner paths and keep
its focused tests green.

## Audit And Financial Decision Points

`admin_audit_logs` must not be quietly skipped by staging restrictive tests. The
preferred future design is a separate platform audit boundary plus tenant-audit
rows for tenant-owned targets. A nullable `organization_id` plus explicit
`scope` discriminator is acceptable only if a later ADR or implementation PR
proves it preserves platform-admin auditability. This decision is required
before staging restrictive RLS tests include admin activity.

`nurse_payouts` must receive a ledger/export decision before non-null or RLS
enforcement. The decision must state which views are tenant-scoped, which remain
platform-ledger scoped, and which exports are blocked until a tenant-safe
financial reporting surface exists.

Temporary audit functions in staging, additional database logs, and manual SQL
reviews are useful supplementary evidence, but they do not replace the required
checklist above.

## Staging Restrictive Fixture

The minimum fixture for later tenant-isolation tests is:

- one platform admin with intentionally audited cross-tenant access
- one tenant admin for Organization A
- one tenant admin for Organization B
- one shared nurse with tenant-scoped completed visits in both organizations
- one isolated nurse visible only in Organization A
- at least one patient/request/assignment/visit chain per organization, with
  additional rows when inference or pagination behavior is under test

Required negative checks:

- Organization A admin cannot read Organization B requests, patients, visits,
  audit rows, payment authorizations, or facility records.
- Shared nurse can see their own allowed cross-tenant shift history only through
  the nurse-facing policy surface that the later isolation slice explicitly
  defines. That surface must not pretend a single tenant GUC can authorize
  cross-organization reads; it must use a reviewed nurse-context policy, bounded
  per-tenant queries, or another explicit mechanism.
- Organization A cannot infer Organization B data through the shared nurse.
- Platform admin access is explicit, audited, and does not run under ordinary
  tenant-scoped policy assumptions.
- Consecutive tenant-scoped requests that reuse the same pooled connection do
  not retain the prior request's tenant context.

## Pause Criteria

Pause before schema expand if table classification is incomplete or PHI-bearing
ownership is ambiguous.

Pause before schema expand if `service_request_events.meta` PHI classification
is incomplete.

Pause before schema expand if `admin_audit_logs` does not have a concrete audit
scope discriminator or a separate tenant/platform audit-table decision.

Pause before schema expand if current data cannot be proven single-tenant for
PHI and tenant-owned workflow data.

Pause before schema expand if `service_requests.referral_partner_id -> users.id`
does not have an explicit sequencing decision for whether referral context is
re-targeted, preserved as platform-only evidence, or excluded from tenant scope.

Pause before backfill if default organization, default facility, or default
jurisdiction bootstrap is not idempotent.

Pause before backfill if the implementation slice does not define and run the
seed-twice verification command or test.

Pause before backfill if orphaned PHI-bearing rows exist in required relationship
chains such as `visits -> assignments -> service_requests`.

Pause before backfill if nurse license jurisdiction remains free text for any
nurse-row or credentialing backfill that depends on structured jurisdiction.

Pause before non-null constraints if any tenant-owned application query lacks
tenant context or tenant predicate evidence.

Pause before non-null constraints if support, analytics, reporting, raw SQL,
background-worker, migration, or seed access lacks tenant-boundary evidence.

Pause before non-null constraints if payout, ledger, export, or financial
reporting paths are not explicitly classified as tenant-scoped, platform-scoped,
blocked, or retired.

Pause before non-null constraints if `nurse_payouts` platform-ledger/export
scope does not have a named decision point and reviewer sign-off in the backfill
or enforcement PR.

Pause before production RLS if staging restrictive tests fail, the connection
role can bypass RLS, or transaction-local GUC cleanup has not been verified for
the deployed pooler.

Pause before production RLS if `assertRlsConnectionRoleReady` is not wired into
startup, health, or migration-runner checks for the deployed environment.

## Slice Sequencing

`NC-E1-03` is the plan only. Later slices must stay separated so each migration
risk can be reviewed and rolled back independently:

- bootstrap organization, facility/location, and jurisdiction tables plus seeds
- add nullable ownership columns, foreign keys, and non-blocking indexes
- wire default-tenant dual-write for new tenant-owned rows
- backfill default ownership in bounded chunks with validation and correction
  queries
- wire tenant-context telemetry and out-of-band access inventory
- add staging restrictive RLS fixtures and tenant-abuse tests
- add non-null constraints and production enforcement after all pause criteria
  are cleared

## Rollback Strategy

For expand and backfill phases, normal rollback is a pause-and-ignore strategy:
nullable columns can remain present while queries continue using the old
single-tenant behavior. Emergency column drops require incident commander
authorization, an audit record, and a follow-up PR; they do not require waiting
for a rollback PR when immediate containment is necessary.

For contract and enforce phases, rollback is an incident procedure:
disable enforcing RLS or relax constraints only with an explicit incident record,
preserve audit evidence, and keep the tenant telemetry signal enabled until the
root cause is fixed.

## Acceptance Criteria For Later Slices

Later schema and RLS implementation slices must not proceed unless they can show:

- default organization, facility, and jurisdiction seeds are idempotent
- newly inserted rows receive default ownership during the migration window
- existing rows backfill deterministically
- orphaned PHI-bearing relationship rows are reconciled or excluded with audit
  evidence before backfill
- tenant-owned and platform-owned access paths are explicitly separated
- app-layer telemetry is zero for tenant-owned unscoped queries
- non-application DB access has tenant-boundary evidence or is blocked
- staging restrictive RLS tests are green with the minimum two-tenant fixture
- unsafe DB roles fail startup or health assertions
- jurisdiction and data-residency launch blockers are documented before any
  multi-region or international production rollout

## Model Review Disposition

Design debate was run before this slice:

- run root: `tmp/slice-design/nc-e1-03-review`
- debate: `tmp/slice-design/nc-e1-03-review/reviews/debate.md`
- Gemini completed.
- Codex blocked on local config: `unknown variant default, expected fast or flex in service_tier`.
- Claude blocked by session limit.
- Copilot timed out after 120 seconds.

Accepted Gemini findings are incorporated here:

- app-layer observe mode is insufficient without out-of-band database access
  evidence
- jurisdiction cannot be deferred only until multi-country launch; the default
  facility needs explicit operational jurisdiction before backfill

Pre-PR model debate was also run for this slice:

- run root:
  `tmp/multi-agent/verify-slice/verify-slice-20260604T163901Z-eb5153`
- debate:
  `tmp/multi-agent/verify-slice/verify-slice-20260604T163901Z-eb5153/reviews/debate.md`
- completed reviewers: Claude, Gemini, and Copilot
- blocked reviewer: Codex local config rejected the configured service tier

Accepted pre-PR findings are incorporated here:

- PHI metadata classification blocks `service_request_events` expand/backfill
- out-of-band DB access evidence is a required checklist, not an optional menu
- connection pooler safety depends on transaction-local GUCs, not session cleanup
- current single-tenant data must be audited before default-org backfill
- `admin_audit_logs`, payout/export paths, and free-text nurse jurisdiction each
  have explicit pause criteria before later schema or RLS work
