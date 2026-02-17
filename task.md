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
