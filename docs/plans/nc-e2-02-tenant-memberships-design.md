# NC-E2-02 Tenant Memberships Design

Date: 2026-06-04
Status: Proposed
Slice: `NC-E2-02 / tenant-memberships`
Branch: `codex/tenant-memberships`
Risk tier: Tier 3
Slice class: implementation design gate

## Purpose

Design the smallest implementation slice that adds organization membership as
the next identity and tenancy primitive after `NC-E2-01 / platform-identity`.

This is a design packet only. It does not add migrations, runtime code, schema,
tests, or app behavior.

## Source Decisions

- ADR-001 chooses shared-schema RLS keyed by `organization_id`.
- ADR-001 chooses organization plus branch/facility/location as the tenant
  shape.
- ADR-001 keeps nurse supply platform-level only for non-PHI routing identity;
  tenant nurse eligibility, credentialing, consent, assignments, visit access,
  and audit evidence are tenant/facility/jurisdiction-scoped context records.
- ADR-002 attaches organization membership to the domain `users` projection, not
  to Better-Auth users.
- ADR-003 expects tenant/resource-aware authorization to read tenant, branch,
  role, ownership, and resource context from a centralized identity boundary.
- `NC-E2-01` centralized current-user resolution through
  `resolveCurrentSessionUser()`, making membership lookup a natural extension
  point.

## Scope For The Implementation Slice

The implementation slice should add the membership foundation only:

- `organizations` table as the RLS tenant boundary.
- `organization_memberships` table linking domain `users.id` to
  `organizations.id`.
- tenant membership enums and indexes.
- tenant-scoped membership query helpers in the identity/platform boundary.
- database and unit tests for allow, deny, inactive, missing, duplicate, and
  cross-tenant membership cases.
- default-organization bootstrap/backfill mechanics for existing single-tenant
  users, using the existing default-tenant backfill runbook constraints.
- tenant-isolation contract updates so membership tables are visible to the
  readiness/guard harness.

## Explicit Non-Scope

- No tenant ownership columns on `service_requests`, `patients`, `assignments`,
  `visits`, events, audit rows, payments, payouts, or notifications.
- No branch/facility/location tables unless the implementer proves they are
  required to make organization memberships tenant-safe.
- No `organization_facility_memberships` or branch-scoped authorization.
- No `tenant_nurse_context`, tenant nurse eligibility, credentialing, consent,
  or nurse-assignment policy.
- No patient household, direct-to-consumer tenant, or consumer account tenant.
- No SSO, SCIM, MFA, invitation flow, admin UI, or tenant self-service UI.
- No replacement of the existing global `users.role` checks.
- No PHI read/write behavior changes.
- No multi-country data-residency topology or concrete jurisdiction policy
  implementation.

## Proposed Schema Contract

### `organizations`

Purpose: customer/legal tenant boundary and future RLS key.

Minimum columns:

- `id uuid primary key default gen_random_uuid()`
- `name text not null`
- `slug text not null unique`
- `status organization_status not null default 'active'`
- `created_by_user_id uuid references users(id) on delete set null`
- `updated_by_user_id uuid references users(id) on delete set null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Required constraints:

- `organizations_slug_format_chk` enforcing lowercase URL-safe slugs, for
  example `slug ~ '^[a-z0-9-]{2,63}$'`.

Allowed enum values:

- `organization_status`: `active`, `suspended`, `archived`

Design notes:

- `organization` is the customer, contracting, BAA/DPA, billing, privacy, audit,
  and RLS tenant boundary.
- organization hard-delete is not a production operation. Use status transition
  to `suspended` or `archived`; a local/test cleanup runbook may drop dependent
  rows only outside production evidence retention.
- A later jurisdiction slice should add the concrete jurisdiction configuration
  relationship before tenant-scoped care data writes become authoritative.
- Do not call the table `tenants`; ADR-001 uses organization as the domain term
  while the platform concept remains tenant.
- `updated_at` must be maintained by an `updated_at` trigger or an equivalent
  deterministic ORM lifecycle path; default-only timestamps are not sufficient.

### `organization_memberships`

Purpose: user-to-organization relationship used by identity and authorization.

Minimum columns:

- `id uuid primary key default gen_random_uuid()`
- `organization_id uuid not null references organizations(id) on delete restrict`
- `user_id uuid not null references users(id) on delete restrict`
- `role organization_member_role not null`
- `status organization_membership_status not null default 'active'`
- `source organization_membership_source not null default 'bootstrap'`
- `created_by_user_id uuid references users(id) on delete set null`
- `updated_by_user_id uuid references users(id) on delete set null`
- `activated_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Required indexes and constraints:

- unique `(organization_id, user_id)` to make one current membership row
  authoritative. This unique constraint is the index for that pair; do not add a
  duplicate non-unique `(organization_id, user_id)` index.
- index `organization_memberships_user_id_idx` on `user_id`.
- index `organization_memberships_organization_id_idx` on `organization_id`.
- index `organization_memberships_org_status_idx` on
  `(organization_id, status)`.

Allowed role enum values:

- `owner`: tenant owner for initial bootstrap and future tenant admin.
- `admin`: tenant admin/operator within one organization.
- `coordinator`: demand-side scheduler/dispatcher within one organization.
- `requester`: demand-side user allowed to initiate or track organization work
  after future authz slices.
- `viewer`: read-only tenant participant for future reporting/support views.

Allowed status enum values:

- `active`
- `invited`
- `disabled`

Allowed source enum values:

- `bootstrap`
- `invitation`
- `api`
- `sso`

Design notes:

- `users.role` remains the legacy/global persona until `NC-E2-03 /
  platform-authz` deliberately moves runtime decisions to tenant/resource
  policies.
- Nurses are not modeled as organization members by default. Tenant-specific
  nurse eligibility and assignment access must use a later tenant nurse context
  record so platform nurse supply does not become one tenant's data.
- Patients are not organization members in this slice. Patient/client demand
  ownership must be handled by future tenant-owned care data rows.
- `invited` supports later invitation flows but must not grant access.
- `disabled` preserves history and must fail closed.
- `user_id` uses `on delete restrict` because membership rows are access
  evidence. Hard-deleting a user must go through a later legal/privacy erasure
  procedure; soft-disable remains the expected operational path.
- `updated_at` must be maintained by an `updated_at` trigger or an equivalent
  deterministic ORM lifecycle path.
- Role or status changes must preserve actor attribution through
  `updated_by_user_id` or an append-only audit/event record before runtime
  mutation paths are exposed.

## Query And Identity Contract

Add identity/platform helpers that are pure enough to test and narrow enough to
avoid rewiring every route:

```ts
type OrganizationMembership = {
  organizationId: string;
  userId: string;
  role: "owner" | "admin" | "coordinator" | "requester" | "viewer";
  status: "active" | "invited" | "disabled";
};

async function listActiveOrganizationMembershipsForUser(input: {
  userId: string;
  limit?: number;
}): Promise<OrganizationMembership[]>;

async function requireOrganizationMembership(input: {
  userId: string;
  organizationId: string;
  roles?: OrganizationMembership["role"][];
}): Promise<OrganizationMembership>;
```

Behavior:

- Missing user, missing membership, inactive membership, disabled membership, and
  wrong role all fail closed.
- `active` must be an explicit whitelist in helper predicates. Do not implement
  "not disabled" or existence-only checks.
- Cross-tenant checks always filter by both `user_id` and `organization_id`.
- Query helpers return membership-safe identifiers and role/status only. They do
  not return PHI, auth tokens, session rows, raw Better-Auth accounts, or care
  data.
- List helpers must use a bounded limit. The v1 default should be 50 and the
  maximum should be 100 memberships per user.
- TypeScript role/status/source unions should derive from Drizzle enum values
  instead of duplicating string literals by hand.
- `resolveCurrentSessionUser()` should not automatically pick a tenant for all
  routes in this slice. Tenant selection and active-organization session claims
  belong to a follow-up authz/session slice unless a narrow API needs an
  explicit membership check.

## Default Organization Bootstrap

The implementation needs a deterministic single-tenant bridge:

- Create one default organization for existing environments.
- Backfill membership rows for existing `users`:
  - current global `admin` users become default-org `owner` in the single-tenant
    bridge. This is intentionally broad for the default tenant only and must be
    revisited before tenant self-service or customer-owned admin flows ship.
  - `referral_partner` users do not receive default organization membership in
    this slice. Existing referral partners may represent separate external
    entities; grouping them into one default organization would create future
    PHI/tenant-isolation risk. Their organization mapping is deferred to a
    dedicated partner/tenant onboarding slice that can use existing
    `organization_name` evidence safely.
  - `patient` and `nurse` users do not receive tenant authority by default.
- The bootstrap must be idempotent and rerunnable.
- The default organization identifier must be visible in local/test seed
  evidence but must not be hard-coded into runtime policy.

## RLS And Isolation Contract

The implementation should prepare membership tables for RLS without broadening
tenant-owned care data:

- `organization_memberships.organization_id` is the tenant key.
- RLS policy readiness should use a fail-closed predicate. The implementation
  must include a reviewed policy template equivalent to:

```sql
organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
```

  There must be no `OR current_setting(...) IS NULL`, no permissive `USING
  (true)`, and no policy branch that broadens access when tenant context is
  unset.
- `withTenantContext()` must be usable around membership reads.
- DB tests must assert `current_setting('app.current_tenant_id', true)` is set
  to the expected organization inside the tested helper path.
- Readiness/guard harness updates should classify:
  - `organizations`: tenant-boundary table
  - `organization_memberships`: tenant-owned membership table, RLS required
- Cross-tenant membership reads must fail in DB-backed tests when tenant context
  is set to another organization.
- Direct membership authorization helpers must filter `status = 'active'`.
  Broader tenant-admin history reads of invited/disabled memberships require a
  separate helper and tests; they must not reuse authorization helpers.

## Legal Jurisdiction Position

Legal jurisdiction is not the tenant boundary. This slice should not implement a
jurisdiction policy table, but it must not block one:

- `organizations` is the future owner of BAA/DPA, billing, privacy, audit, and
  jurisdiction configuration relationships.
- No care-data write should become tenant-authoritative in this slice, so the
  missing jurisdiction policy is acceptable for membership-only work.
- A later slice must add jurisdiction configuration before request creation,
  nurse eligibility, assignment, retention, vendor policy, or cross-region
  notification behavior becomes multi-country production scope.

## Rollback And Migration Safety

- The schema addition is expand-only.
- No existing runtime path should depend on memberships until tests prove the
  backfill and helper contracts.
- If migration fails, roll back by dropping the new tables/enums before any
  tenant-owned care data starts referencing them.
- If backfill creates bad membership rows, disable rows by status instead of
  deleting audit-relevant relationship evidence.
- If an organization is no longer usable, transition `status` to `suspended` or
  `archived`; do not hard-delete production organizations.
- Do not make `users.role` or existing routes dependent on membership in the
  same slice.

## Required Tests

Focused local tests:

- schema export and migration metadata checks.
- helper unit tests for role/status allow and deny.
- DB tests:
  - user with active membership can list the correct organization.
  - user without membership receives a fail-closed error.
  - `invited` and `disabled` memberships do not authorize.
  - user with Org A membership cannot satisfy an Org B check.
  - duplicate membership insertion fails.
  - `withTenantContext(Org A)` cannot read Org B memberships.
  - unset tenant context returns zero membership rows rather than broad access.
  - helper predicates authorize only `status = 'active'`.
  - `current_setting('app.current_tenant_id', true)` matches the expected
    organization inside tested tenant-scoped paths.
- tenant-isolation harness readiness/guard tests for the two new tables.
- default-org bootstrap idempotency tests.

Required gates:

- `pnpm mcp:preflight`
- focused DB/unit tests added by the slice
- `pnpm db:verify-meta`
- `pnpm test:architecture`
- `pnpm verify-slice`
- `pnpm verify-slice -- --run-root <run_root> --static`
- reviewer pool from `<run_root>/reviewer-plan.md`
- `pnpm verify-slice -- --run-root <run_root> --required-gates`
- PR CI, Sonar, GitGuardian, API E2E, UI smoke, and PR Finalizer

## Reviewer Matrix

| Surface | Risk | Reviewer route |
|---|---|---|
| Schema/migration/RLS readiness | High | architecture + contracts + security |
| Identity membership helpers | High | security + auth/tenancy review |
| Default organization bootstrap | Medium-high | QA + ops |
| Jurisdiction and marketplace nurse boundary | High | architecture + product/legal critique |
| Runtime route behavior | Low in this slice | verify no runtime route changes except narrow helper adoption if justified |

## Acceptance Criteria

The implementation slice is complete only when:

- `organizations` and `organization_memberships` exist with Drizzle schema,
  migration SQL, and migration metadata.
- membership helpers filter by `user_id`, `organization_id`, active status, and
  optional roles.
- DB-backed tests prove active allow and missing/inactive/wrong-tenant deny.
- DB-backed tests prove unset tenant context fails closed.
- default organization bootstrap/backfill is deterministic and idempotent.
- existing global `admin` users are mapped to default-org `owner`; existing
  `referral_partner`, `patient`, and `nurse` users are not granted tenant
  authority by default.
- tenant isolation readiness/guard evidence includes membership tables.
- `updated_at`, actor attribution, activation time, and membership source are
  present or explicitly rejected with a stronger audit mechanism before merge.
- no PHI-bearing or care-data table becomes tenant-owned in this slice.
- no runtime authorization path treats membership as authoritative without a
  focused test.
- all local and PR gates pass.

## Closed Review Questions

1. Do not add a nullable jurisdiction reference yet. Add the concrete
   jurisdiction relationship in the dedicated jurisdiction configuration slice.
2. Map existing global `admin` users to default-org `owner` for the single-tenant
   bridge.
3. Do not grant `referral_partner` users default organization membership in this
   slice; defer partner-to-organization mapping to a dedicated onboarding slice.
4. Keep unique `(organization_id, user_id)` as the authoritative current row.
   Use actor fields or a later append-only event/audit log for history.
5. Defer branch/facility tables from this slice. ADR-001 still requires
   organization plus facility from v1 before care-site transactional ownership,
   but no membership-safe query in `NC-E2-02` requires half-designed facility
   schema. A later facility design gate must own facility schema, facility
   membership, jurisdiction, and branch-scoped authorization together.

## Model Review Disposition

Model review ran on 2026-06-04 with minimized non-PHI packet
`docs/plans/nc-e2-02-tenant-memberships-design.md`.

Evidence:

- `docs/reviews/nc-e2-02-tenant-memberships-design-review.md`
- `tmp/multi-agent/design-review/nc-e2-02-tenant-memberships/reviews/debate.md`
- `tmp/multi-agent/design-review/nc-e2-02-tenant-memberships/reviews/claude.md`
- `tmp/multi-agent/design-review/nc-e2-02-tenant-memberships/reviews/gemini.md`
- `tmp/multi-agent/design-review/nc-e2-02-tenant-memberships/reviews/copilot.md`
- `tmp/multi-agent/design-review/nc-e2-02-tenant-memberships/reviews/codex.md`

Routes:

- `claude` completed and required preserving membership audit evidence,
  fail-closed RLS policy wording, and fixed bootstrap decisions.
- `gemini` completed and required not grouping referral partners into one
  default tenant; it recommended adding facilities now.
- `copilot` completed and required explicit active-status whitelisting,
  timestamp maintenance, and organization lifecycle/deactivation guidance.
- `codex` was blocked by local CLI config (`service_tier` value rejected);
  this is missing advisory signal, not approval.

Accepted findings:

- `user_id` changed from `on delete cascade` to `on delete restrict`.
- fail-closed RLS policy template added.
- bootstrap mappings closed.
- `status = 'active'` whitelist contract added.
- `updated_at` maintenance, actor attribution, activation timestamp, and source
  requirements added.
- slug format, bounded list helper, and unset-tenant negative tests added.

Rejected with rationale:

- Adding a minimal facility table in `NC-E2-02` is rejected. It is valid product
  pressure from ADR-001, but implementing a half-designed facility table without
  facility membership, jurisdiction, and branch-scoped authorization would widen
  the slice and create downstream schema commitments before the care-site
  ownership slice is ready.
