# ADR-001: Tenant / Account Model

**Status:** Proposed
**Date:** 2026-06-02
**Deciders:** NurseConnect architecture
**Related:** ADR-002 (identity), ADR-003 (authz), ADR-004 (outbox); enterprise-readiness report §6, §9 Phase 1

## Context

NurseConnect v3 is single-tenant: no `organizations`/`tenants` table, no `tenant_id` on any domain row (verified — tenant columns appear only in `packages/database/src/schema/auth.ts`, Better-Auth's own tables; the only "organization" is a free-text `referral_partners.organization_name`). Enterprise customers require data isolation and org-scoped roles. This is the single largest enterprise blocker, and retrofitting tenancy gets more expensive as data accumulates.

Interdomestik (`interdomestik-crystal-home`) has a production-grade, verified tenancy stack we can reuse: `tenants` + `tenant_settings` + `branches` (`packages/database/src/schema/tenants.ts`, `rbac.ts`), `withTenantContext()` with RLS-via-GUC (`database/src/tenant.ts`), defense-in-depth helpers (`tenant-security.ts`), and a fail-closed role assertion (`rls-role-assertion.ts`).

The open decision is **tenant shape**, which depends on the first enterprise customer type (report Open Question #2).

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

## Decision (recommended)

**Split into two decisions so the customer-model gate doesn't block the irreversible part.**

**Decision A — DECIDE NOW (high confidence, irreversible, no customer input needed):** adopt **shared-schema multi-tenancy with Postgres RLS**, keyed off a session GUC (`app.current_tenant_id`), porting Interdomestik's `withTenantContext`; require a **non-superuser DB role** guarded by `assertRlsConnectionRoleReady()` (`rls-role-assertion.ts`); add `organizations` + `org_memberships`; and add `tenant_id`/`organization_id` to domain tables (with composite unique `(tenant_id, id)` on the tables we will FK-scope — not blindly all, per §5.1 of the report). Reject schema-per-tenant / DB-per-tenant (too costly for many small orgs; RLS gives sufficient isolation with a non-superuser role).

**Decision B — DEFER until first-customer model is confirmed (reversible):** whether to ship a **branch hierarchy** (org → branch) in v1, or stay **flat orgs**. This is the only part that genuinely depends on customer type, so it should not gate Decision A.

**Hedge that keeps B cheap:** add a **nullable `branch_id`** column now (unused if flat). Flat behaves as a strict subset; if branches arrive later, the column already exists and the change is additive (policies + memberships), avoiding a second schema-wide migration. Recursive parent/child trees (Option 3) remain deferred until a customer needs them.

Rationale: the isolation *mechanism* (RLS + GUC + non-superuser role) carries no customer-specific risk and is the expensive-to-retrofit part — decide it now. The *hierarchy shape* is genuinely customer-dependent and reversible if we pre-provision the nullable column — defer it. This removes the self-contradiction of gating the whole ADR on a customer answer while also recommending org→branch.

## Consequences

**Positive:** unblocks B2B; DB-enforced isolation (defense in depth) not just app filters; proven pattern; flat orgs still trivial.

**Negative / costs:** every domain table gains `tenant_id NOT NULL` + composite unique `(tenant_id, id)`; every query must be tenant-scoped; a non-superuser RLS connection role must be provisioned; a schema-wide migration (sequenced in report §9 Phase 1 as expand/contract with an RLS permissive-logging step before enforcing).

**Required guardrails (port from Interdomestik):** `withTenant`/`assertTenant` query helpers, the fail-closed `assertRlsConnectionRoleReady()`, and the `abuse_test_rls.js` + `e2e-tenant-host-lanes` isolation tests in CI.

## Verification

- RLS isolation test: tenant A cannot read/write tenant B (as `*.db.test.ts`).
- Startup assertion test: app refuses to boot if the DB role can bypass RLS.
- Migration test: the app-layer tenant-scope telemetry signal is zero **and** the staging restrictive-RLS suite is green before `organization_id` goes non-null and prod RLS is enabled (see Appendix A — there is no native Postgres "log-but-allow" mode).

## Open items

- Confirm first-customer type to finalize **Decision B** (whether branches ship in v1).
- Decide shared vs copy-and-own of Interdomestik's tenancy package (report Open Question #1 — recommend copy-and-own).

---

## Appendix A — Migration mechanics & the "observe-before-enforce" mechanism

This appendix exists because the migration plan's earlier phrasing ("enable RLS in permissive/logging mode") was misleading. **Postgres RLS has no native "log the violation but allow the row" mode.** A policy either filters rows or it doesn't; `ENABLE ROW LEVEL SECURITY` with a permissive `USING (true)` policy allows everything and logs nothing. So "observe-before-enforce" must be *built*. Pick one (recommended: combine 1 + 3):

1. **App-layer tenant-scope telemetry (primary).** Instrument the DB client wrapper and the `withTenant`/`assertTenant` helpers so any query that executes **without** a tenant predicate (or without the `app.current_tenant_id` GUC set) emits a structured warning with the call site. This catches the "query you forgot" at the application boundary, where you can see the stack. Drain this signal to zero before step 7.

2. **Audit-function-in-policy (DB-level observe).** You *can* simulate log-but-allow by writing an RLS policy `USING (tenant_observe(tenant_id))` where `tenant_observe()` is a function that, when a session flag (`app.tenant_enforce = off`) is set, `RAISE LOG`s any row whose `tenant_id` ≠ the GUC and returns `true` (allow). Flip the session flag to enforcing later. This is real "log-but-allow," but it adds a function call per row and must be removed/simplified before production enforcement.

3. **Staging-restrictive-first (cheapest, highest signal).** Enable **enforcing** RLS in a staging/CI environment seeded with ≥2 tenants and run the full E2E + `abuse_test_rls.js` suite. Every unscoped query *fails loudly* in staging — which is exactly what you want — without risking a prod leak or a prod allow-and-log window. Fix in staging, then enable in prod.

4. **Shadow dual-read (highest assurance, most work).** For read paths, run each query both unscoped (current) and under a restrictive tenant role, and diff row counts; a mismatch flags a scoping gap. Reserve for high-risk endpoints.

**Recommended path:** (3) staging-restrictive-first as the gate + (1) app-layer telemetry in production during the rollout window. Reserve (2) only if you need a true prod observe window, and (4) only for the riskiest endpoints. The migration test in *Verification* should assert the telemetry signal (1) is zero and the staging restrictive suite (3) is green before `organization_id` goes non-null and prod RLS is enabled.

**Column pre-provisioning:** add nullable `organization_id` **and** nullable `branch_id` in the same expand step (Decision B hedge), backfill `organization_id` to the default tenant, leave `branch_id` null. This avoids a second table-rewriting migration if branches are adopted later.
