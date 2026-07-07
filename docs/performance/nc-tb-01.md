# NC-TB-01 Performance Evidence

## Scope

NC-TB-01 changes database shape and backfill behavior. It must protect request,
visit, payment, admin queue, and seed/test paths from avoidable downtime while
preserving current query behavior.

Runtime behavior remains unchanged except that new write paths populate default
tenant ownership during the migration window.

## Verification

- Nullable-column expand must use bounded migration steps and avoid long
  blocking locks where the selected migration mechanism allows it.
- Production index creation must use `CREATE INDEX CONCURRENTLY` where the
  migration mechanism permits it. Any non-concurrent index must have an
  explicit low-row-count or maintenance-window justification in PR evidence.
- Data backfill must run through `scripts/backfill-tenant-ownership.mjs`, which
  commits each table batch separately; it is not embedded in the transactional
  Drizzle migration.
- Relationship-owned child rows must backfill from parent chains to avoid
  expensive cross-domain reads at runtime.
- Focused behavior checks cover request create/assign, partner request
  projections, visit timelines, payment trace, and admin active/exception
  queues.
- Full `pnpm gate:release` and `pnpm verify-slice -- --required-gates` are
  required before PR.

Operational evidence lives in
`docs/evidence/nc-tb-01/pre-backfill-audit.md`. It defines row-count stop
conditions, orphan checks, zero-null reconciliation, rollback order, and the
transactional-migration justification for non-concurrent index/FK creation.
