# NC-TB-01 Tenant Expand Rollout

Status: required operator sequence for the nullable tenant-ownership expand release.

This runbook covers only NC-TB-01. It does not authorize `NOT NULL`, RLS
enforcement, composite tenant foreign keys, or removal of the compatibility
window. Do not copy production identifiers or row-level data into evidence.

## Preconditions

- Capture sanitized row counts and orphan counts from the pre-backfill audit.
- Stop if an included table exceeds 100,000 rows without an approved maintenance
  window and target-shaped timing evidence.
- Confirm the application version currently serving traffic tolerates the new
  nullable columns.
- Confirm the backfill runner, statement timeout, lock timeout, and rollback
  owner are available before migration begins.

## Compatibility Window

1. Place request-state, request-event, payment-authorization, and payout
   mutations into a bounded maintenance hold. Reads may continue.
2. Apply the expand migration. The columns remain nullable so the pre-release
   application can still read the schema.
3. Run `scripts/backfill-tenant-ownership.mjs` with the reviewed batch and
   timeout settings. Keep only aggregate JSON evidence.
4. Run the runner again with `--check-only`. Every null, orphan, parent/child
   organization mismatch, and branch/organization mismatch count must be zero.
5. Deploy the NC-TB-01 application writers that require and persist tenant
   ownership. Do not enable these writers before step 4 is green.
6. Run `--check-only` once more against the deployed version, then release the
   mutation hold.
7. Monitor aggregate error and lock-timeout rates for the agreed observation
   period. This slice does not advance to RLS enforcement.

The mutation hold is mandatory unless a separately reviewed compatibility
deployment proves that both old and new writers safely coexist throughout the
backfill. That alternative evidence must identify the exact versions and
cannot be inferred from a passing local run.

## HOLD Triggers

Keep or re-enter the mutation hold when any of the following occurs:

- migration or backfill exceeds its statement or lock timeout;
- any reconciliation count is non-zero;
- a parent/child tenant mismatch appears;
- a new writer rejects a legacy nullable parent;
- database error rate, lock contention, or request mutation failures exceed the
  approved deployment threshold;
- the deployed application version cannot be confirmed.

## Rollback Triggers And Direction

Rollback the application deployment when writer failures, ownership mismatches,
or unexplained mutation errors appear. Keep mutations held. The database-first
rollback is not safe after tenant-aware writers are deployed.

For an application rollback, return to the compatibility version that tolerates
nullable tenant columns, rerun `--check-only`, and leave the additive columns in
place. Treat any post-release schema removal as an operations incident and a
separate reviewed cleanup. Do not drop tenant columns while any deployed writer
depends on them.

If that separate cleanup is authorized, its reverse order must start by
dropping `payment_authorizations_request_owner_fk` and
`nurse_payouts_request_owner_fk`, followed by
`service_requests_payment_owner_uidx` and
`service_requests_payout_owner_uidx`. Only then may the 0017 tenant FKs,
indexes, and nullable columns be removed. This 0017+0018 order was rehearsed on
the disposable `nurseconnect_test` database inside a rolled-back transaction.

Release traffic only after the incident owner records a zero-count reconciliation
and confirms the serving version. If zero reconciliation cannot be restored,
stop the rollout and escalate; NC-TB-01 is not deployable in that environment.
