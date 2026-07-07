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
- Backfill chunks must set explicit lock and statement timeouts and use bounded
  transaction sizes.
- Relationship-owned child rows must backfill from parent chains to avoid
  expensive cross-domain reads at runtime.
- Focused behavior checks cover request create/assign, partner request
  projections, visit timelines, payment trace, and admin active/exception
  queues.
- Full `pnpm gate:release` and `pnpm verify-slice -- --required-gates` are
  required before PR.
