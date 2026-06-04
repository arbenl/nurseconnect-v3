# Tenant Isolation Abuse Tests

`NC-E1-04` adds the tenant-isolation abuse-test contract before tenant-owned
schema and production RLS policies exist. The current expected state is
`ADVISORY_PASS_PENDING_SCHEMA`, not a claim that Tenant A/B isolation is already
enforced.

## Commands

```bash
pnpm tenant:isolation -- --mode readiness --source drizzle
pnpm tenant:isolation -- --mode guard --source drizzle
pnpm tenant:isolation -- --mode enforce --source drizzle
pnpm tenant:isolation -- --mode enforce --source live
```

`readiness` mode exits `0` for the current pre-schema state and prints the
missing table, tenant-column, RLS, and scenario-assertion guardrails. It should
only fail when the script or contract is invalid.

`guard` mode is the incremental schema-adoption gate. It exits non-zero only
when a tenant-owned table has started tenant-schema work, such as adding
`organization_id`, but is missing required companion guardrails such as RLS or
resource-scope columns. It does not require all future tables to exist in one
PR.

`enforce` mode is the full staging restrictive-RLS gate. It exits non-zero until
the tenant-owned schema, RLS guardrails, and required executable scenario
assertions exist. If `--source live` is used without `DATABASE_URL`, enforce mode
exits `2` so CI cannot silently degrade to an advisory no-op.

The shared contract lives in `config/tenant-isolation-contract.json`. Future
schema and RLS slices must update that contract instead of maintaining a
parallel table or scenario list in prose.

Live inspection uses the `pg` package. Keep that dependency available to the
workspace before wiring `--source live` into CI.

## Promotion Trigger

Add the abuse-test command to required gates in `guard` mode in the PR that
introduces the `organizations` table or the first domain-table `organization_id`
tenant column, whichever lands first.

At that point the required gate should use:

```bash
pnpm tenant:isolation -- --mode guard --source drizzle
```

Promote to full `enforce` mode only in the PR that completes the full
tenant-owned schema, RLS policies, and executable scenario assertions for the
staging restrictive fixture:

```bash
pnpm tenant:isolation -- --mode enforce --source drizzle
```

The staging restrictive-RLS lane should additionally run live inspection and the
DB/API isolation tests against a database seeded with at least two organizations:

```bash
pnpm tenant:isolation -- --mode enforce --source live
```

Do not claim production RLS enforcement until staging restrictive tests run
against at least two tenants and the full tenant-owned fixture.

## Required Scenario Contract

The contract requires executable assertion references for:

- Tenant A cannot read Tenant B rows.
- Tenant A cannot create or update Tenant B rows.
- Wrong-tenant request, patient, visit, audit, payment authorization, and
  facility access attempts fail.
- A shared nurse cannot expose or infer another organization's data through
  tenant-scoped surfaces.
- Platform-admin cross-tenant access is explicit and audited.
- Consecutive tenant-scoped requests that reuse one physical connection do not
  retain the prior tenant context.

The pooled-connection cleanup scenario is already covered by
`packages/database/src/tenant-context.db.test.ts` in the test named
`does not leak sequential tenant contexts on one physical connection`.

The other scenario entries intentionally have empty `assertionRefs` today. They
must remain empty until a future schema/RLS slice adds deterministic DB/API tests
that would fail if the represented scenario is not actually exercised.

## Fixture Requirements

The later staging restrictive fixture must include:

- one platform admin with intentionally audited cross-tenant access
- one tenant admin for Organization A
- one tenant admin for Organization B
- one shared nurse with tenant-scoped completed visits in both organizations
- one isolated nurse visible only in Organization A
- at least one patient/request/assignment/visit chain per organization

Shared-nurse access must not pretend a single tenant GUC authorizes
cross-organization reads. The later implementation must use a reviewed
nurse-context policy, bounded per-tenant queries, or another explicit mechanism.

Platform-admin access must not run as an ordinary tenant-policy bypass. It must
be explicit, audited, and reviewed as a separate authorization surface.

## Current Non-Scope

This harness does not add organizations, facilities, memberships, jurisdiction
tables, tenant columns, RLS policies, PHI fixtures, API behavior, or production
authorization behavior. It is a fail-closed contract and readiness check for
future schema/RLS work.
