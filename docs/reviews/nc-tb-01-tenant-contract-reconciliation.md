# NC-TB-01 Tenant Contract Reconciliation

Date: 2026-07-07
Status: Design evidence
Slice: `NC-TB-01 / tenant-expand`

## Question

Should the NC-TB-01 care-site scope column be `branch_id` or `facility_id`?

## Authority Finding

`docs/plans/current-tracker.md` and
`docs/plans/ENTERPRISE_UPGRADE_TRACKER.md` define NC-TB-01 as adding nullable
`organization_id` plus `branch_id` to domain tables. The tracker authority
outranks `config/tenant-isolation-contract.json`, which previously expected
`facility_id` for `service_requests` and `visits`.

ADR-001 permits branch/facility/location vocabulary for the higher-level tenant
model, but it does not override the promoted slice's literal tracker wording.

## Disposition

NC-TB-01 uses `branch_id`. The tenant-isolation contract is amended to expect
`branch_id` on care-site scoped tenant-owned tables before schema work starts.

Any later choice to rename this scope to `facility_id` must be handled as a
reviewed tracker and contract amendment before migration generation.

## Evidence

- `docs/plans/current-tracker.md` promotes NC-TB-01 with `branch_id`.
- `docs/plans/ENTERPRISE_UPGRADE_TRACKER.md` mirrors the `branch_id` scope.
- `config/tenant-isolation-contract.json` now expects `branch_id` where NC-TB-01
  adds a care-site resource discriminator.
- `scripts/__tests__/tenant-isolation-abuse.test.mjs` now exercises
  `branch_id` as the resource column in the contract harness.

## Non-Decision

This note does not create runtime schema, tenant RLS, production query behavior,
or branch authorization rules. Those remain NC-TB-01 implementation work and
must pass the required gates before PR.
