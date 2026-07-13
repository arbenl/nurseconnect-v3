# NC-TB-01 Tenant Expand Design

Date: 2026-07-07
Status: Proposed
Slice: `NC-TB-01 / tenant-expand`
Implementation branch: `codex/tenant-expand`
Risk tier: Tier 3

## Purpose

Prepare the current single-tenant data plane for later observe/enforce tenant
isolation by creating deterministic default ownership records, adding nullable
tenant ownership columns, backfilling existing rows, and proving invariants
without changing production query behavior.

## Source Decisions

- `current-program.md` promotes `NC-TB-01` after `NC-E2-04`.
- `current-tracker.md` names default org/facility bootstrap, nullable
  `organization_id` plus `branch_id`, default backfill, reversibility, and no
  query behavior change.
- `docs/runbooks/default-tenant-backfill-plan.md` requires default
  organization/facility/jurisdiction seeds, single-tenant audit, PHI
  classification, bounded backfill, dual-write defaults, and pause criteria.
- `config/tenant-isolation-contract.json` was amended in this slice's design
  package to require `branch_id` on care-site scoped tenant tables, matching
  tracker authority before migration.

## Naming Decision

Tracker authority requires literal `branch_id` for NC-TB-01. This design package
aligns the tenant-isolation contract to that authority. Runtime migration must
therefore implement `branch_id`; any later move to `facility_id` requires a
reviewed tracker and contract amendment before schema generation.

## Scope

- Add or reuse deterministic default organization, branch, and jurisdiction
  bootstrap with seed-twice idempotency proof.
- Add nullable `organization_id` to tenant-owned domain tables.
- Add nullable `branch_id` with a concrete branch FK target and jurisdiction
  seed contract.
- Backfill current rows to the default tenant and default branch using parent
  relationship chains where available.
- Add invariant tests and sanitized reconciliation evidence.
- Keep RLS enforcement, non-null constraints, and query behavior unchanged.

## Table Matrix

| Table | NC-TB-01 action | Scope rule |
|---|---|---|
| `service_requests` | add `organization_id`, `branch_id` unless amended | default tenant/care-site |
| `patients` | add `organization_id` | org only; facility deferred |
| `assignments` | add `organization_id` | derive from request |
| `visits` | add `organization_id`, `branch_id` unless amended | derive through assignment/request |
| `service_request_events` | add `organization_id` | mandatory after `meta` classification |
| `payment_authorizations` | add `organization_id` | derive from request |
| `nurse_payouts` | add `organization_id` | derive from request; ledger enforce deferred |
| `admin_audit_logs` | no column in NC-TB-01 | pause unless split-table or scope-discriminator decision is accepted |
| `nurses` | no column in NC-TB-01 | platform nurse profile remains non-tenant; tenant nurse context is successor work |
| `nurse_locations`, `service_areas` | defer with decision | platform/jurisdiction scope must be recorded |
| `referral_partners`, `users`, auth tables | no tenant columns | preserve referral context as platform-only evidence unless amended |

## Implementation Sequence

1. Run single-tenant audit and orphan checks for every included table.
2. Classify `service_request_events.meta`; pause the slice if incomplete.
3. Record accepted dispositions for `admin_audit_logs`, referral sequencing,
   and nurse tenant-context handoff in
   `docs/evidence/nc-tb-01/pause-dispositions.md`.
4. Add idempotent default organization/branch/jurisdiction seed support.
5. Add nullable columns, indexes, and foreign keys for included tables.
6. Add default ownership writes for new rows before bulk backfill.
7. Backfill with `scripts/backfill-tenant-ownership.mjs`, which commits each
   table batch separately outside the transactional Drizzle migration.
8. Prove zero-null ownership for included rows and relationship consistency.
9. Record rollback/down-path rehearsal evidence.

## Runtime Write Inventory

- `apps/web/src/server/requests/allocate-request.ts`
- `packages/domain-request/src/request-events.ts`
- `packages/domain-payments/src/payment-trace.ts`
- test/seed helpers that insert requests, visits, payments, or events directly

## Non-Scope

- Production RLS enforcement, `organization_id NOT NULL`, a tenant-wide
  composite FK contract beyond the narrow payment/request ownership invariant,
  two-tenant abuse fixture, tenant observe telemetry, outbox, CQRS
  repair, PHI read audit, encryption, retention, erasure, and broad route
  behavior changes.

## Stop Conditions

- a later `branch_id` versus `facility_id` amendment is proposed without
  reviewed tracker and contract changes.
- Single-tenant audit, orphan checks, or pseudo-tenant signal review fails.
- `service_request_events.meta` classification is incomplete.
- `docs/evidence/nc-tb-01/pause-dispositions.md` is missing or contradicts
  repo authority.
- Default seed is not idempotent.
- Backfill would log PHI or production identifiers.
- Reversibility/down-path rehearsal is unproven, or rollback evidence does not
  pair schema cleanup with application rollback for tenant-aware write paths.
- `tenant:isolation` readiness or guard fails for reasons other than the
  documented `ADVISORY_PASS_PENDING_SCENARIOS` NC-TB-03 scenario handoff.

## Verification Plan

- `pnpm tenant:isolation -- --mode readiness --source drizzle`
- `pnpm tenant:isolation -- --mode guard --source drizzle`
- seed-twice DB test for default organization/branch/jurisdiction
- `scripts/backfill-tenant-ownership.mjs` executable backfill/reconciliation
  proof on a disposable migrated database
- zero-null invariant for included `organization_id` rows after backfill
- zero-null invariant for care-site scope on request/visit rows
- relationship consistency checks for request-owned child rows
- focused DB/API/domain tests for request, visit, payments, admin ops, referral,
  dispatch, nurse, and identity surfaces
- `pnpm architecture:boundaries`
- `pnpm modularity:guard`
- `pnpm gate:release`
- `pnpm verify-slice -- --required-gates`
