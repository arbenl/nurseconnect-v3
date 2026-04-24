# M8: Production Monitoring and Alerting Design

## Verdict

Approved for implementation as a launch-readiness operations slice.

M8 adds production visibility without changing dispatch, payment, triage, or
request lifecycle behavior. It uses the monitoring primitives already present
in the repository: structured JSON API logs, Vercel OpenTelemetry, health
routes, admin ops read models, audit logs, and launch runbooks.

## Current State

The codebase already has:

- structured API logging through `logApiStart`, `logApiSuccess`, and
  `logApiFailure`
- Vercel OpenTelemetry wired through `@vercel/otel`
- `GET /api/health/db`, currently a `SELECT 1` health check
- SSR admin ops dashboard backed by `getAdminOpsDashboard()`
- active queue severity logic with
  `DEFAULT_TRIAGE_SEVERITY_POLICY.staleEventThresholdMinutes`
- admin audit actions for payment authorization and payout failures
- exception queue UI and API
- no Sentry dependency and no notification hook
- no current helper that counts the intersection of verified and available nurse
  supply; `getNurseCredentialCounts()` exposes `verified` and `available`
  separately, which is not sufficient for launch supply health

## Design Choice

M8 uses Option A for launch: existing structured logs plus Vercel OTel/log
drains as the primary alerting path.

Sentry is explicitly deferred to a later monitoring slice. It remains useful
for client-side error capture and grouped release tracking, but adding it is
not required for the controlled first launch.

## Scope

M8 adds:

1. `GET /api/health` as a lightweight composite health endpoint.
2. `GET /api/admin/ops/status` as an admin-authenticated machine-readable
   operational status endpoint.
3. Stale assigned/enroute request counts based on the existing triage stale
   event threshold.
4. Payment trace gap counts and recent payment/payout failure counts.
5. An optional `OPS_ALERT_WEBHOOK_URL` hook for high-signal payment/payout
   failure audit actions.
6. Runbook updates for post-deploy monitoring, escalation thresholds, and
   environment setup.

## Out Of Scope

M8 does not add:

- Sentry or client-side JavaScript error capture
- public status pages
- auth/login failure aggregation
- new database tables
- automatic intake pausing or incident remediation
- Slack/PagerDuty product-specific SDKs

## Health Endpoint

`GET /api/health` is intentionally lightweight and safe for high-frequency
uptime polling. It must not include business incident queries.

The endpoint checks:

- database connectivity with `SELECT 1`
- active service area count
- verified and available nurse count from a dedicated intersection query

Response shape:

```json
{
  "ok": true,
  "db": "ok",
  "serviceAreas": { "active": 2 },
  "nurseSupply": { "verifiedAndAvailable": 4 },
  "timestamp": "2026-04-21T09:00:00.000Z"
}
```

If any required check fails, return HTTP 500 with `ok: false`, set the failed
subsystem to `"error"` where applicable, and log through `logApiFailure`.

`/api/health/db` remains available for existing launch-day-card and external
monitor compatibility, but launch docs should prefer `/api/health` for the
composite launch check.

## Admin Ops Status Endpoint

`GET /api/admin/ops/status` is admin-authenticated and intended for operators,
external synthetic monitors with admin credentials, and future internal status
surfaces.

It must not be public. It should use the same auth pattern as existing admin
routes and return 401/403 for non-admin access.

Response shape:

```ts
{
  generatedAt: string;
  db: "ok" | "error";
  serviceAreas: { active: number };
  nurseSupply: { verifiedAndAvailable: number };
  requests: {
    unassigned: number;
    staleAssigned: number;
    staleEnroute: number;
    exceptionQueue: number;
  };
  payments: {
    authorizationsWithoutPayout: number;
    recentFailedAuthorizations: number;
    recentFailedPayouts: number;
  };
}
```

The stale request threshold must reference
`DEFAULT_TRIAGE_SEVERITY_POLICY.staleEventThresholdMinutes` from
`triage-severity.ts`; do not hardcode a new threshold constant.

Stale request counts should count:

- `staleAssigned`: requests in `assigned` status whose latest request event is
  older than the threshold
- `staleEnroute`: requests in `enroute` status whose latest request event is
  older than the threshold

Exception queue count should include requests in `needs_review`, `declined`,
and `unfulfilled`.

Payment counts should include:

- `authorizationsWithoutPayout`: requests with a payment authorization row in
  `authorized` or `captured` status and no nurse payout row for the same
  `request_id`; `voided` and `failed` authorizations are not outstanding payout
  gaps
- `recentFailedAuthorizations`: recent admin audit rows with action
  `payment.authorization.failed`
- `recentFailedPayouts`: recent admin audit rows with action `payout.failed`

The default "recent" window is 24 hours unless implementation discovers an
existing project constant that is more appropriate.

## Domain Placement

The health endpoint may use small route-local count queries because it is a
transport health surface and must stay simple.

Verified and available nurse supply must use a new helper in
`@nurseconnect/domain-nurse`:

```ts
export async function getVerifiedAndAvailableNurseCount(): Promise<number>;
```

That helper must count only rows where `nurses.status = "verified"` and
`nurses.isAvailable = true`. Do not compose this from the existing
`getNurseCredentialCounts().verified` and `.available` values because those are
separate counts, not an intersection.

The ops status queries belong in `@nurseconnect/domain-admin-ops`, not in the
Next.js route. Add a `getAdminOpsStatus()` projection that composes:

- active service area count
- verified and available nurse count
- active queue unassigned count
- stale assigned/enroute counts
- exception queue count
- payment trace gap counts
- recent payment/payout failure audit counts

The API route should stay a thin auth, logging, and response adapter.

## Alert Hook

`OPS_ALERT_WEBHOOK_URL` is optional. If unset, the app only emits structured
logs and OTel events.

When set, it should notify only for high-signal launch events:

- `payment.authorization.failed`
- `payout.failed`

Hook placement is critical:

- The webhook must fire after the audit write transaction commits.
- It must never run inside the database transaction.
- It must be fire-and-forget.
- It must catch failures and call `logApiFailure`.
- It must never throw to the request path.
- A failed or hanging webhook must never roll back the audit write or the
  payment/payout state change.

Implementation should keep the hook behind a small helper such as
`notifyOpsAlert(...)`. Place the call inside `mutateAdminPaymentTrace()` in
`apps/web/src/server/payments/admin-payment-trace.ts`, after the
`await db.transaction(...)` call returns and before the final
`getAdminPaymentTrace()` return call. Pass only the resolved audit action,
`requestId`, and `actorUserId`; the route should not duplicate alert-worthy
audit action knowledge.

The webhook payload should be small and non-PHI:

```json
{
  "event": "payment.authorization.failed",
  "requestId": "uuid",
  "actorUserId": "uuid",
  "timestamp": "2026-04-21T09:00:00.000Z",
  "details": {
    "source": "admin.request.paymentTrace"
  }
}
```

## Logging and Error Handling

Both new routes should follow existing `createApiLogContext`, `logApiStart`,
`logApiSuccess`, `logApiFailure`, and `withRequestId` patterns.

`/api/health` should return failure details only at subsystem granularity. It
should not leak SQL errors or PHI.

`/api/admin/ops/status` can return operational counts but must not expose raw
patient, nurse, or request detail. It is a summary endpoint.

## Runbook Updates

Update all three launch docs:

- `docs/runbooks/launch_day_card.md`
  - add a post-deploy first-hour monitoring section after the go/no-go steps
  - include `/api/health` polling, admin ops status polling, admin dashboard
    refresh cadence, and first real request completion watch
- `docs/runbooks/launch_readiness_review.md`
  - add escalation thresholds to the go/no-go criteria
  - include unassigned request, stale enroute, exception queue, and failed
    payment/payout thresholds
- `docs/runbooks/production_bootstrap_runbook.md`
  - add `OPS_ALERT_WEBHOOK_URL` as optional production alerting configuration
  - reference `/api/health` and `/api/admin/ops/status`

## Escalation Thresholds

Initial launch thresholds:

- `GET /api/health` is not `ok`: stop launch or pause intake immediately
- active service areas equals 0: do not launch or pause intake
- verified and available nurse supply equals 0: do not accept new requests
- unassigned requests `>= 3` for more than 5 minutes: operator escalation
- any stale enroute request: operator escalation
- exception queue `>= 5`: operator review before expanding intake
- any recent failed authorization or payout: finance/operator review

These thresholds are intentionally conservative for a controlled first launch.

## Testing

Required tests:

- `/api/health` success shape with seeded active area and nurse supply
- verified but unavailable nurses are not counted in `verifiedAndAvailable`
- available but unverified nurses are not counted in `verifiedAndAvailable`
- `/api/health` failure path logs and returns `ok: false`
- `/api/admin/ops/status` requires admin auth
- `/api/admin/ops/status` response shape includes request and payment counts
- stale assigned/enroute projection uses the existing stale threshold constant
- payment authorization without payout is counted only for `authorized` and
  `captured` authorizations
- `voided` and `failed` authorizations without payout are not counted as payout
  gaps
- recent payment/payout failure audit rows are counted
- `OPS_ALERT_WEBHOOK_URL` hook fires only after successful mutation/audit write
- webhook failures are swallowed and logged, not thrown

Validation gates:

```bash
pnpm -w type-check
pnpm lint
pnpm test:ci
pnpm test:api
pnpm gate:e2e-api
pnpm --filter web build
```

## Implementation Order

1. Add plain TypeScript response contracts:
   - `packages/contracts/src/health.ts` with `HealthResponse`
   - `packages/contracts/src/admin-ops-status.ts` with
     `AdminOpsStatusResponse`
   - export both from `packages/contracts/src/index.ts`
2. Add `getVerifiedAndAvailableNurseCount()` in
   `@nurseconnect/domain-nurse`.
3. Add `getAdminOpsStatus()` in `@nurseconnect/domain-admin-ops` with unit/DB
   coverage.
4. Add `GET /api/health`.
5. Add admin route `GET /api/admin/ops/status`.
6. Add optional post-commit alert helper and call it from
   `mutateAdminPaymentTrace()` after `db.transaction(...)` completes and before
   returning the refreshed trace.
7. Update runbooks.
8. Run the validation gates listed above before opening the implementation PR.
