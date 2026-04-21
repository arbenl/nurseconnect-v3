# M8: Production Monitoring and Alerting Plan

## Branch

`codex/production-monitoring-alerting`

## Goal

Add launch-grade monitoring surfaces and alert hooks without changing request,
dispatch, triage, or payment lifecycle semantics.

## Implementation Steps

1. Add response contracts:
   - `packages/contracts/src/health.ts` with `HealthResponse`
   - `packages/contracts/src/admin-ops-status.ts` with
     `AdminOpsStatusResponse`
   - export both from `packages/contracts/src/index.ts`

2. Add verified-and-available nurse supply helper:
   - `packages/domain-nurse/src/credential-lifecycle.ts`
   - query `nurses.status = "verified"` and `nurses.isAvailable = true`
   - export from `packages/domain-nurse/src/index.ts`
   - test that verified-but-unavailable and available-but-unverified nurses are
     excluded

3. Add admin ops status projection:
   - `packages/domain-admin-ops/src/ops-status.ts`
   - export from `packages/domain-admin-ops/src/index.ts`
   - include stale assigned/enroute counts using
     `DEFAULT_TRIAGE_SEVERITY_POLICY.staleEventThresholdMinutes`
   - count authorization-without-payout gaps only for `authorized` and
     `captured` authorizations
   - count recent `payment.authorization.failed` and `payout.failed` audit
     rows over the default 24-hour window

4. Add `GET /api/health`:
   - route-local `SELECT 1`
   - active service area count
   - `getVerifiedAndAvailableNurseCount()`
   - no stale request or payment gap queries

5. Add `GET /api/admin/ops/status`:
   - admin auth via existing `requireRole("admin")`
   - route runs `SELECT 1` and merges top-level `db`
   - pass business counts from `getAdminOpsStatus()`
   - keep the domain projection focused on business counts, not DB liveness

6. Add optional ops alert hook:
   - helper in `apps/web/src/server/alerts/ops-alert.ts`
   - uses `OPS_ALERT_WEBHOOK_URL` when set
   - fire-and-forget
   - catch and log with `logApiFailure`
   - never throw
   - call from `mutateAdminPaymentTrace()` after `await db.transaction(...)`
     completes and before returning `getAdminPaymentTrace(requestId)`
   - alert only for `payment.authorization.failed` and `payout.failed`

7. Update runbooks:
   - `docs/runbooks/launch_day_card.md`
   - `docs/runbooks/launch_readiness_review.md`
   - `docs/runbooks/production_bootstrap_runbook.md`

## Validation

Run focused tests as each slice lands, then:

```bash
pnpm -w type-check
pnpm lint
pnpm test:ci
pnpm test:api
pnpm gate:e2e-api
pnpm --filter web build
```
