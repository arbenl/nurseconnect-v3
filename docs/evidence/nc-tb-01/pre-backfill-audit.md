# NC-TB-01 Pre-Backfill And Rollback Evidence

Date: 2026-07-07
Status: required PR evidence

## Scope

This evidence covers the NC-TB-01 expand migration and checked operations
backfill. The migration adds nullable tenant ownership columns and creates the
default organization/branch. `scripts/backfill-tenant-ownership.mjs` backfills
rows with per-batch commits and produces reconciliation output. This does not
authorize RLS enforcement, `NOT NULL`, composite tenant FKs, or executable tenant
A/B abuse-test claims.

## Pre-Backfill Row Counts

Run on the target database before applying the migration. Do not paste PHI,
patient identifiers, request addresses, logs, secrets, credentials, or
production identifiers into PR evidence.

Query shape: `count(*)` for `service_requests`, `patients`, `assignments`,
`visits`, `service_request_events`, `payment_authorizations`, and
`nurse_payouts`.

Stop conditions:

- Any included table exceeds 100,000 rows without a reviewed maintenance window
  and a backfill progress/retry runner.
- Any orphan query below returns rows.
- The migration dry run exceeds the configured statement timeout on a
  production-shaped fixture.

Local disposable evidence, `nurseconnect_test`, 2026-07-07:

| Table | Sanitized row count |
| --- | ---: |
| `service_requests` | 1 |
| `patients` | 0 |
| `assignments` | 0 |
| `visits` | 0 |
| `service_request_events` | 0 |
| `payment_authorizations` | 0 |
| `nurse_payouts` | 0 |

The local disposable fixture stays below the stop threshold and contains no
production data.

## Relationship Consistency

Query shape: count request-owned children whose parent path is missing:
`assignments -> service_requests`, `visits -> assignments -> service_requests`,
`service_request_events -> service_requests`,
`payment_authorizations -> service_requests`, and
`nurse_payouts -> service_requests`.

Local disposable evidence, `nurseconnect_test`, 2026-07-07:

| Check | Rows |
| --- | ---: |
| `orphan_assignments` | 0 |
| `orphan_visits` | 0 |
| `orphan_events` | 0 |
| `orphan_payment_authorizations` | 0 |
| `orphan_nurse_payouts` | 0 |

## Pseudo-Tenant Signal Audit

The runner fails closed before updates when it finds multiple referral/care-provider organization names, service-area groups, or operator email domains.
These checks are `pseudo_tenant_referral_or_care_provider_groups`,
`pseudo_tenant_service_area_groups`, and `pseudo_tenant_operator_groups` in
`scripts/lib/tenant-backfill-plan.mjs`; any non-zero result holds rollout for a mapping slice. The disposable fixture returned zero for each; its integration test proves two referral organizations make `--check-only` fail before updates.
The same preflight blocks non-default existing ownership, orphan, and parent/child mismatch signals before any batch commits.

## Post-Backfill Reconciliation

Query shape: count null `organization_id` on all included tenant-owned tables
and null `branch_id` on `service_requests` and `visits`.

All counts must be zero for NC-TB-01 acceptance on the migrated database.

Local disposable evidence, after applying the default tenant/branch backfill to
`nurseconnect_test`, 2026-07-07:

| Check | Rows |
| --- | ---: |
| `service_requests_null_org` | 0 |
| `patients_null_org` | 0 |
| `assignments_null_org` | 0 |
| `visits_null_org` | 0 |
| `service_request_events_null_org` | 0 |
| `payment_authorizations_null_org` | 0 |
| `nurse_payouts_null_org` | 0 |
| `service_requests_null_branch` | 0 |
| `visits_null_branch` | 0 |

## Backfill Runner Evidence

Checked runner: `scripts/backfill-tenant-ownership.mjs`.

Local disposable fixture, `nurseconnect_test`, 2026-07-07:

- Synthetic rows inserted across `service_requests`, `patients`, `assignments`,
  `visits`, `service_request_events`, `payment_authorizations`, and
  `nurse_payouts` with null tenant ownership.
- Command:
  `PSQL_BIN=/opt/homebrew/opt/libpq/bin/psql DATABASE_URL=... node scripts/backfill-tenant-ownership.mjs`.
- Result: `status: pass`; each included table updated 1 row; all 14
  reconciliation/orphan checks returned 0.

## Migration Safety

The required compatibility window, mutation hold, deployment order, HOLD
triggers, and rollback direction are defined in
`docs/runbooks/nc-tb-01-tenant-expand-rollout.md`.

The migration uses plain `CREATE INDEX` because the current Drizzle migration
runner applies migrations transactionally, and PostgreSQL does not allow
`CREATE INDEX CONCURRENTLY` inside a transaction block. This is acceptable only
when the pre-backfill row-count gate above stays below the stop threshold or a
reviewed maintenance window is recorded in PR evidence. If the row-count gate is
exceeded, split index creation into an explicitly non-transactional operations
runbook before applying to that environment.

## Rollback And Down Path

If the migration has not been released, rollback is to drop the uncommitted
migration artifacts and regenerate metadata from schema.

If applied to a disposable database, rehearse this reverse order:

1. Drop `payment_authorizations_request_owner_fk` and
   `nurse_payouts_request_owner_fk`.
2. Drop `service_requests_payment_owner_uidx` and
   `service_requests_payout_owner_uidx`, then the 0017 tenant indexes.
3. Drop FKs from tenant-owned tables to `organizations` and `branches`.
4. Drop nullable `organization_id` and `branch_id` columns from included tables.
5. Drop the `branches` table and `branch_status` enum.
6. Keep the pre-existing `organizations` and `org_memberships` structures.

Production rollback after release must be treated as an operations incident.
Because write paths begin depending on tenant columns in this slice, rollback
must first deploy an application revert that no longer writes tenant ownership.
The preferred database rollback is then to leave nullable inert columns in place
until a reviewed cleanup slice.

Local full-surface rehearsal, `nurseconnect_test`, 2026-07-13:

- Reversed both 0018 owner FKs/indexes, every 0017 tenant FK/index/column,
  `branches`, and `branch_status` inside an explicit transaction.
- Rolled back before commit: `full_rollback_rehearsal_transaction | rolled_back`.
