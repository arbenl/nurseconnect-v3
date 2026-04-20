# M6: Automated Launch Rehearsal Design

## Purpose

M6 turns the M5 manual launch rehearsal into a repeatable automated gate. It does
not add production monitoring, alerting, or new product behavior. It verifies that
the already-merged launch surfaces still work together as one operational flow.

## Scope

Add a targeted launch rehearsal command:

```bash
pnpm launch:rehearsal
```

The command should first run `pnpm launch:readiness`, then run a focused
Playwright API test. The test owns its test data and resets the E2E database like
the existing API suite.

## Rehearsed Flow

The automated rehearsal covers the launch-day path:

1. Database health endpoint returns `{ ok: true, db: "ok" }`.
2. Admin login and `/api/admin/ping` work.
3. Admin can see an active service area.
4. A verified nurse with an in-area location can receive a patient request.
5. Patient request is assigned, accepted, marked enroute, and completed.
6. Admin can see the request timeline and record payment authorization plus
   nurse payout trace.
7. Referral partner can create a request and see it in the partner portal API.
8. Admin can move an operational exception through needs-review, declined, and
   reopened states.

## Architecture

Use the existing Playwright API project and E2E helpers:

- `apps/web/tests/e2e-api/launch-rehearsal.api.e2e.ts` contains the single
  high-level rehearsal.
- `apps/web/tests/e2e-utils/db.ts` and `helpers.ts` seed users, nurses, nurse
  locations, service areas, and partner profiles.
- `apps/web/package.json` exposes `test:e2e:launch-rehearsal`.
- `scripts/launch-rehearsal.sh` enforces a test-safe database, prepares a clean
  schema, builds contracts, and runs the focused Playwright rehearsal.
- Root `package.json` exposes `launch:rehearsal`.

This keeps rehearsal automation inside the existing test harness and avoids a
second custom runner.

## Failure Model

The test should fail loudly at the exact launch step that regresses. Each API
call includes response text in the assertion message for fast CI diagnosis.

## Out Of Scope

- Production monitoring and alerting.
- Real payment processor integration.
- Browser UI launch rehearsal.
- Use of seeded real/staging credentials from `pnpm launch:seed`.
- Full launch data generation beyond the one rehearsal path.

## Validation

- `pnpm launch:rehearsal`
- `pnpm launch:readiness`
- `pnpm -w type-check`
- `pnpm lint`
- `pnpm test:ci`
- `pnpm gate:e2e-api`
