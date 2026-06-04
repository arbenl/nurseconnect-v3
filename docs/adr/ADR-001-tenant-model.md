# ADR-001: Tenant / Account Model

**Status:** Accepted
**Date:** 2026-06-04
**Deciders:** NurseConnect architecture
**Related:** ADR-002 (identity), ADR-003 (authz), ADR-004 (outbox); enterprise-readiness report §6, §9 Phase 1

## Context

NurseConnect v3 is single-tenant: no `organizations`/`tenants` table, no `tenant_id` on any domain row (verified — tenant columns appear only in `packages/database/src/schema/auth.ts`, Better-Auth's own tables; the only "organization" is a free-text `referral_partners.organization_name`). Enterprise customers require data isolation and org-scoped roles. This is the single largest enterprise blocker, and retrofitting tenancy gets more expensive as data accumulates.

Interdomestik (`interdomestik-crystal-home`) has a production-grade, verified tenancy stack we can reuse: `tenants` + `tenant_settings` + `branches` (`packages/database/src/schema/tenants.ts`, `rbac.ts`), `withTenantContext()` with RLS-via-GUC (`database/src/tenant.ts`), defense-in-depth helpers (`tenant-security.ts`), and a fail-closed role assertion (`rls-role-assertion.ts`).

The previously open decision was **tenant shape**. This ADR now closes it as organization plus branch/facility/location, while leaving implementation details to the NC-E1 slices below.

## Decision Drivers

- Who is the first enterprise customer: hospital network, staffing agency, referral-partner network, or franchise/multi-branch operator?
- Strength of isolation required (healthcare PHI → strong, fail-closed).
- Migration cost on existing single-tenant data.
- Reuse of Interdomestik patterns vs over-fitting to a different domain.

## Options

1. **Flat organizations.** `organizations` + `org_memberships(user, org, role)`. Single-level RLS. Simplest.
2. **Org → branch hierarchy (Interdomestik's model).** `organizations` + `branches` + memberships scoped to org and optionally branch. Two-level RLS, branch-scoped queries.
3. **Arbitrary parent/child org tree.** Recursive hierarchy. Most flexible, most complex (recursive RLS, ancestor resolution).
4. **Schema-per-tenant / DB-per-tenant.** Strong physical isolation, high operational cost, poor fit for many small orgs.

## Decision

**Decision A — shared-schema tenant isolation:** adopt **shared-schema multi-tenancy with Postgres RLS**, keyed off a session GUC (`app.current_tenant_id`), porting Interdomestik's `withTenantContext`; require a **non-superuser DB role** guarded by `assertRlsConnectionRoleReady()` (`rls-role-assertion.ts`); add `organizations` + `org_memberships`; and add `tenant_id`/`organization_id` to domain tables (with composite unique `(tenant_id, id)` on the tables we will FK-scope — not blindly all, per §5.1 of the report).

**Decision B — organization plus branch/facility:** ship **organization → branch/facility/location** as the v1 tenant shape. `organization` is the customer/contracting, legal-party, BAA/DPA, and RLS tenant boundary. `branch`/`facility`/`location` is a first-class resource scope for demand, assignments, visits, audit, exports, and branch-scoped authorization.

The minimum schema contract for the shape is:

- `organizations` owns the RLS tenant boundary.
- each organization maps to an explicit customer legal/contracting profile for BAA/DPA, billing, privacy, and audit ownership.
- `branches`/`facilities`/`locations` belongs to exactly one `organization_id`.
- membership and authorization can scope actors to an organization and optionally to one or more branches/facilities through an explicit relationship such as `organization_facility_memberships`.
- foundational RLS policies key off `organization_id`; branch/facility restrictions are enforced by authorization/resource policy on top of the tenant boundary unless a later slice proves a DB-level branch predicate is required.

For the on-demand staffing model, NurseConnect separates supply from demand:

- **Demand is tenant-scoped.** Requests, assignments, visits, patient/client records, notes, CRM records, communications, notifications, audit rows, and billing/export evidence belong to the requesting `organization_id` and, where the workflow is tied to a care site, a `branch_id`/`facility_id`.
- **Nurse supply is platform-level only for non-PHI routing identity.** Platform-level nurse data is limited to identity/routing fields needed to match and contact supply safely.
- **Tenant nurse context is tenant/facility/jurisdiction scoped.** Eligibility, credentialing state, compliance checks, consents, availability commitments, assignment participation, visit access, PHI exposure, and audit evidence are represented through explicit tenant-scoped relationship records such as `tenant_nurse_eligibility`, `tenant_nurse_context`, memberships, or assignments, not as repeated tenant columns on the platform nurse profile.
- **Legal jurisdiction is not the tenant.** Country, region/state, market, and legal jurisdiction are operating/compliance scopes that constrain organizations, facilities, nurse eligibility, request rules, language, currency, timezone, privacy regime, BAA/DPA obligations, retention, vendor policy, and data-residency topology. The enforcement hook is a jurisdiction configuration referenced by organizations and facilities; request creation, nurse eligibility, assignment, retention, and vendor policy checks must resolve through that jurisdiction before writes that create tenant-scoped care data.
- **Audit follows the owning boundary.** Tenant audit rows bind to the requesting organization and facility where applicable. Platform-level supply or marketplace events that are not owned by one tenant use a separate platform audit boundary and must not contain PHI.
- **Direct-to-consumer demand is not implicit v1 scope.** If added later, D2C demand must use an explicit organization-equivalent tenant/contractual ownership model, such as a household/customer account tenant, before request or PHI rows are created. Demand rows must not bypass tenant ownership with nullable organization identifiers.

Recursive parent/child organization trees remain deferred until a customer needs them. Physical schema-per-tenant or DB-per-tenant isolation remains deferred for ordinary customers, but regional or physical isolation must be re-evaluated before any multi-country production deployment or contractual data-residency requirement. International/GDPR scope must be decided before any NC-E3+ slice that introduces cross-region notifications, workers, integrations, or international-market launch behavior.

Rationale: the business model is closer to an on-demand healthcare staffing marketplace than a single-facility staffing app. Customer demand needs a tenant boundary strong enough for BAA/customer contracts, PHI isolation, audit, and exports. Nurses may serve more than one customer, so modeling nurse profile as owned by exactly one tenant would underfit marketplace supply. Branch/facility must be present from v1 because facility-scoped roles, assignment ownership, audit evidence, and later CRM primitives all depend on the same resource boundary.

## Consequences

**Positive:** unblocks B2B and on-demand staffing; DB-enforced isolation (defense in depth) not just app filters; proven pattern; facility-scoped authorization and audit are available without a later schema-wide retrofit; platform-level nurse supply remains possible without making PHI platform-global.

**Negative / costs:** every tenant-owned domain table gains `tenant_id`/`organization_id` plus the FKs and uniqueness needed for tenant-safe relationships; demand-side transactional tables also need branch/facility ownership where care-site scope applies; every query must be tenant-scoped; a non-superuser RLS connection role must be provisioned; platform-level nurse data needs a strict classification so PHI, credentialing evidence, consents, and assignment participation do not leak across tenants.

**Required guardrails (port from Interdomestik):** `withTenant`/`assertTenant` query helpers, the fail-closed `assertRlsConnectionRoleReady()`, and the `abuse_test_rls.js` + `e2e-tenant-host-lanes` isolation tests in CI.

## Verification

- RLS isolation test: tenant A cannot read/write tenant B (as `*.db.test.ts`).
- Startup assertion test: app refuses to boot if the DB role can bypass RLS.
- Tenant-shape contract test: demand-side rows that represent requests, assignments, visits, notes, audit, or exports cannot be created without an owning organization and, where care-site scoped, a branch/facility.
- Nurse-boundary contract test: platform-level nurse profile access cannot expose tenant-specific PHI, visit, assignment, consent, credentialing, or audit data without a tenant context.
- Jurisdiction contract test: tenant-scoped care-data writes cannot proceed without resolving the organization's or facility's jurisdiction configuration.
- Migration test: the app-layer tenant-scope telemetry signal is zero **and** the staging restrictive-RLS suite is green before `organization_id` goes non-null and prod RLS is enabled (see Appendix A — there is no native Postgres "log-but-allow" mode).

## Open items

- Decide shared vs copy-and-own of Interdomestik's tenancy package (report Open Question #1 — recommend copy-and-own).
- Define the exact platform nurse vs tenant nurse data-classification table before schema work.
- Define regional/data-residency deployment criteria before multi-country production rollout.
- Define the concrete jurisdiction configuration table/policy shape before implementing cross-country launch behavior.

---

## Appendix A — Migration mechanics & the "observe-before-enforce" mechanism

This appendix exists because the migration plan's earlier phrasing ("enable RLS in permissive/logging mode") was misleading. **Postgres RLS has no native "log the violation but allow the row" mode.** A policy either filters rows or it doesn't; `ENABLE ROW LEVEL SECURITY` with a permissive `USING (true)` policy allows everything and logs nothing. So "observe-before-enforce" must be *built*. Pick one (recommended: combine 1 + 3):

1. **App-layer tenant-scope telemetry (primary).** Instrument the DB client wrapper and the `withTenant`/`assertTenant` helpers so any query that executes **without** a tenant predicate (or without the `app.current_tenant_id` GUC set) emits a structured warning with the call site. This catches the "query you forgot" at the application boundary, where you can see the stack. Drain this signal to zero before step 7.

2. **Audit-function-in-policy (DB-level observe).** You *can* simulate log-but-allow by writing an RLS policy `USING (tenant_observe(tenant_id))` where `tenant_observe()` is a function that, when a session flag (`app.tenant_enforce = off`) is set, `RAISE LOG`s any row whose `tenant_id` ≠ the GUC and returns `true` (allow). Flip the session flag to enforcing later. This is real "log-but-allow," but it adds a function call per row and must be removed/simplified before production enforcement.

3. **Staging-restrictive-first (cheapest, highest signal).** Enable **enforcing** RLS in a staging/CI environment seeded with ≥2 tenants and run the full E2E + `abuse_test_rls.js` suite. Every unscoped query *fails loudly* in staging — which is exactly what you want — without risking a prod leak or a prod allow-and-log window. Fix in staging, then enable in prod.

4. **Shadow dual-read (highest assurance, most work).** For read paths, run each query both unscoped (current) and under a restrictive tenant role, and diff row counts; a mismatch flags a scoping gap. Reserve for high-risk endpoints.

**Recommended path:** (3) staging-restrictive-first as the gate + (1) app-layer telemetry in production during the rollout window. Reserve (2) only if you need a true prod observe window, and (4) only for the riskiest endpoints. The migration test in *Verification* should assert the telemetry signal (1) is zero and the staging restrictive suite (3) is green before `organization_id` goes non-null and prod RLS is enabled.

**Column rollout:** add `organization_id` and the branch/facility ownership columns in the same expand step for tables that are tenant-owned or care-site scoped. Backfill `organization_id` to the default tenant during single-tenant migration. Backfill branch/facility ownership from existing workflow data where possible; where no reliable source exists, use an explicit default facility/location record for the default tenant rather than leaving transactional care-site rows permanently unscoped.
