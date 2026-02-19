# PR-3.8 Task Checklist: Request Lifecycle + Nurse Accept/Reject

## Scope
- [x] Extend request lifecycle statuses and DB fields for operational flow beyond auto-assignment
- [x] Implement strict server-side transition rules and authorization
- [x] Add nurse request action endpoints (`accept`, `reject`, `enroute`, `complete`) and patient `cancel`
- [x] Keep business logic centralized in `apps/web/src/server/requests/*`
- [x] Update shared contracts for payloads/statuses/response shape
- [x] Add unit + DB integration + API E2E tests for lifecycle actions
- [x] Keep UI changes minimal and API-first

## Database
- [x] Added `service_request_status` enum values: `open`, `assigned`, `accepted`, `enroute`, `completed`, `canceled`, `rejected`
- [x] Added lifecycle timestamps on `service_requests`:
  - [x] `assigned_at`
  - [x] `accepted_at`
  - [x] `enroute_at`
  - [x] `completed_at`
  - [x] `canceled_at`
  - [x] `rejected_at`
- [x] Migration generated and wired through `db:migrate`
- [x] Left extension point for future `service_request_events` audit table in request action service

## Policy Decisions
- [x] Nurse availability policy:
  - [x] `accept` requires nurse profile and `isAvailable=true`
  - [x] `accept` flips `isAvailable=false`
  - [x] `reject`/`complete`/patient `cancel` set assigned nurse `isAvailable=true`
- [x] Idempotency/conflict policy:
  - [x] Repeated lifecycle action to same resulting state returns `409 Conflict` (consistent policy)

## State Machine Implemented
- [x] `assigned -> accepted`
- [x] `accepted -> enroute`
- [x] `enroute -> completed`
- [x] `assigned/accepted -> open` via `reject` (reopen flow)
- [x] `open/assigned/accepted -> canceled` (patient-only)

## API Routes Added
- [x] `POST /api/requests/[id]/accept`
- [x] `POST /api/requests/[id]/reject`
- [x] `POST /api/requests/[id]/enroute`
- [x] `POST /api/requests/[id]/complete`
- [x] `POST /api/requests/[id]/cancel`

## UI
- [x] Nurse dashboard assignment card includes action buttons for lifecycle progression
- [x] Patient dashboard request card shows latest active request status
- [x] UI remained minimal to preserve e2e stability

## Tests
- [x] Unit: transition validator (`canTransition`)
- [x] DB integration:
  - [x] Assigned nurse can accept
  - [x] Other nurse forbidden
  - [x] Concurrent accepts: single success + stable final state
- [x] API E2E:
  - [x] Full flow create -> assigned -> accept -> patient sees `accepted`
  - [x] Reject flow reopens request to `open`

## CI/Gate Alignment
- [x] `db:migrate` remains the migration path
- [x] Root `gate:e2e-api` now builds contracts before running API E2E to avoid stale contract exports

---

# PR-3.9 Task Checklist: Nurse Location Update API + Deterministic Throttle

## Scope
- [x] Add nurse-only endpoint to update current location (`PATCH /api/me/location`)
- [x] Keep contract-first implementation (shared Zod schemas in `packages/contracts`)
- [x] Add deterministic throttle for repeated location updates
- [x] Preserve allocation behavior so nearest nurse selection uses latest location data
- [x] Expand API-first E2E with location endpoint coverage

## Contracts
- [x] Added request schema: `NurseLocationUpdateRequestSchema` (`lat`, `lng`)
- [x] Added response schema: `NurseLocationUpdateResponseSchema` (`ok`, `throttled`, `lastUpdated`)
- [x] Exported new location contracts through `packages/contracts/src/index.ts`

## Server Implementation
- [x] Added service: `apps/web/src/server/nurse-location/update-my-location.ts`
  - [x] validates actor is nurse role
  - [x] requires nurse profile record (`nurses` table)
  - [x] performs upsert into `nurse_locations`
  - [x] enforces fixed 30-second throttle window for repeated updates
- [x] Added route: `apps/web/src/app/api/me/location/route.ts`
  - [x] `401` for unauthenticated users
  - [x] `400` for invalid payload
  - [x] `403` for non-nurse/incomplete nurse profile
  - [x] `200` for successful update with typed payload

## Tests
- [x] Added DB integration tests:
  - [x] first location write creates row
  - [x] immediate second write is throttled and keeps previous coordinates
  - [x] non-nurse user gets forbidden error
- [x] Added API E2E tests:
  - [x] non-nurse cannot update location
  - [x] nurse can update location
  - [x] location endpoint affects nearest nurse assignment outcome

## CI/Gate Alignment
- [x] Verified with blocking lanes:
  - [x] `pnpm -w type-check`
  - [x] `pnpm lint`
  - [x] `pnpm test:ci`
  - [x] `pnpm --filter web test:api`
  - [x] `pnpm gate:e2e-api`
