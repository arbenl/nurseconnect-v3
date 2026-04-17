# NurseConnect Domain Visit Extraction
Date: 2026-04-17
Status: Proposed
Scope: Enterprise architecture Step 7 after merged Step 6 (`@nurseconnect/domain-identity` user expansion)

## Purpose
Define the `@nurseconnect/domain-visit` extraction boundary so the live care experience read side moves out of `apps/web` without reopening request write policy, dispatch write policy, or introducing a new visit schema.

This is a read-model extraction spec.

It is not:
- a request action rewrite
- a dispatch policy rewrite
- a new `visits` table proposal
- a patient-domain extraction
- an admin request-detail redesign

## Executive Summary
`@nurseconnect/domain-visit` should own the live visit experience read side:
- patient active-visit and recent-history projections
- nurse active-assignment and recent-history projections
- actor-scoped visit timeline reads
- actor-scoped visit notification reads
- shared visit-state helpers used by routes and UI

`apps/web` should remain the delivery and transport layer:
- HTTP request parsing and response formatting
- route auth enforcement
- polling cadence and cache semantics
- read-audit instrumentation
- page and component composition

`domain-request` remains the source of request write truth.
`domain-dispatch` remains the source of assignment truth.
`domain-visit` reads those sources and shapes them into actor-safe visit projections.

## Current Visit Surface
- `apps/web/src/server/requests/request-events.ts`
- `apps/web/src/app/api/requests/mine/route.ts`
- `apps/web/src/app/api/requests/assigned/route.ts`
- `apps/web/src/app/api/requests/[id]/events/route.ts`
- `apps/web/src/app/api/me/notifications/route.ts`
- `apps/web/src/components/dashboard/patient-request-card.tsx`
- `apps/web/src/components/dashboard/patient-request-status-card.tsx`
- `apps/web/src/components/dashboard/patient-request-history-card.tsx`
- `apps/web/src/components/dashboard/patient-request-timeline.tsx`
- `apps/web/src/components/dashboard/nurse-assignment-card.tsx`
- `apps/web/src/hooks/use-nurse-assignment-feed.ts`

Related but explicitly out of scope:
- `apps/web/src/server/requests/request-actions.ts`
- `apps/web/src/server/requests/allocate-request.ts`
- `apps/web/src/server/requests/admin-reassign.ts`
- `apps/web/src/app/api/requests/route.ts`
- `apps/web/src/app/admin/requests/[id]/page.tsx`
- `apps/web/src/app/admin/requests/[id]/reassign-panel.tsx`
- `apps/web/src/app/api/admin/activity/reassignments/route.ts`
- `apps/web/src/server/admin/audit.ts`

## Core Decisions

### 1. `domain-visit` is a read-model package only
This package should own semantic visit reads, not visit mutations.

That means:
- read and shape actor-safe visit data
- centralize active/history/timeline/notification semantics
- expose reusable lifecycle helpers

This package should not:
- create requests
- assign or reassign nurses
- mutate nurse availability
- append request events
- write audit rows

### 2. The business boundary is the live visit experience, not the patient record
This slice should be modeled as `domain-visit`, not `domain-patient`.

Why:
- NurseConnect’s core operating unit is the visit lifecycle
- the remaining app-local logic clusters around active request status, assignment visibility, timelines, and notifications
- these flows cut across patient, nurse, request, and dispatch concerns

`domain-patient` can come later when patient-owned rules become substantial enough to stand on their own.

### 3. Active and history projections must be distinct
`domain-visit` should not fetch one rich shape and slice it in memory for multiple use cases.

Instead:
- active visit/assignment reads may be deeper projections
- history reads should be shallow and DB-limited

This keeps the extraction performant and prevents the package from normalizing over-fetching as its public API.

### 4. Projections must be actor-safe by construction
Raw `service_requests` or joined rows must not cross the package boundary.

`domain-visit` should map database rows into explicit safe shapes:
- patient-facing projections
- nurse-facing projections
- actor-scoped notifications
- actor-scoped timeline events

This prevents accidental PHI leakage when patient, nurse, and admin-facing consumers evolve independently.

Public response schemas remain owned by `@nurseconnect/contracts`.
`domain-visit` owns the mapping from DB rows into those shape-compatible projections.

### 5. Cursor-based history and notification reads should be first-class
Where history or notification pagination is needed, `domain-visit` should use cursor inputs rather than offset-based pagination.

Recommended shape:
- first page: `cursor = null`
- next page: a cursor derived from the last item in the previous page

To preserve stable ordering, the cursor should be based on:
- `createdAt`
- `id`

This avoids offset scans as request-event history grows.

Current UI callers do not need to adopt pagination immediately.
Step 7 should preserve current behavior by calling the first page with the existing limits where applicable.

### 6. Shared visit-state helpers belong in the package
Status-group helpers like “active visit” or “terminal visit” should not remain scattered across routes and components.

`visit-state.ts` should export helpers such as:
- `isVisitActive(status: RequestStatus)`
- `isVisitTerminal(status: RequestStatus)`
- `isVisitHistorical(status: RequestStatus)`

These helpers should use shared status types from `@nurseconnect/contracts` so state drift becomes a compiler failure rather than a runtime mismatch.

### 7. Query functions should be intent-shaped and inject `DbClient`
The public package API should express domain intent instead of exposing “fetch everything and slice it” helpers.

Examples:
- `getPatientVisitProjection(db, input)`
- `getNurseVisitProjection(db, input)`
- `getVisitTimelineForActor(db, input)`
- `getVisitNotificationsForActor(db, input)`

These functions should accept `DbClient` as a dependency rather than hard-importing the global `db`.

Why:
- improves testability
- allows transaction reuse where needed
- keeps the package aligned with the extraction style already used in the newer domain slices

### 8. The package surface must be a strict facade
`src/index.ts` should be a hand-written facade, not an `export *` barrel.

Only the public domain-visit API should be exportable:
- projection readers
- safe public types
- visit-state helpers
- domain-visit errors

Internal row mappers and join helpers must stay package-private.

## Target Package Shape

```text
packages/domain-visit/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts
    errors.ts
    visit-state.ts
    patient-visit-projections.ts
    nurse-visit-projections.ts
    visit-timeline.ts
    visit-notifications.ts
```

Notes:
- this package is projection-first, not route-first
- internal mapping helpers should remain file-local unless a later extraction proves they need their own shared module
- initial extraction may continue to depend directly on `@nurseconnect/database`

## Package Responsibilities

### `visit-state.ts`
Owns reusable visit lifecycle categories.

Responsibilities:
- define shared active/terminal/historical status helpers
- use `RequestStatus` from `@nurseconnect/contracts`
- become the single source of truth for route and UI status grouping

This module should be pure and heavily unit-tested.

### `patient-visit-projections.ts`
Owns patient-facing live visit projections.

Responsibilities:
- return an actor-safe active visit projection for the patient portal
- return shallow recent-history items for the patient portal
- keep active vs history reads intentionally distinct
- hide raw request rows behind mapping functions

This module does not:
- decide request creation rules
- expose raw DB rows
- own patient account/profile logic

### `nurse-visit-projections.ts`
Owns nurse-facing live assignment projections.

Responsibilities:
- return an actor-safe active assignment projection for nurse dashboard use
- return shallow recent-assignment history
- centralize nurse-side “current assignment” semantics
- remove fetch-all-then-slice logic from app routes

This module does not:
- assign or reassign nurses
- mutate availability
- expose dispatch internals beyond the safe projection

### `visit-timeline.ts`
Owns actor-scoped timeline reads for a single visit/request.

Responsibilities:
- verify that the actor may view the visit timeline
- read and shape the visit event history for one request
- return a safe timeline projection

This module should replace app-local timeline access checks currently living beside the read query.

### `visit-notifications.ts`
Owns actor-scoped notification reads derived from request events.

Responsibilities:
- read notification-visible request events for admins, nurses, and patients
- apply actor-specific visibility rules
- support cursor-based pagination and limit handling
- return a safe notification projection

This module does not own:
- HTTP cache validators
- unread tracking
- notification mutation state

### `errors.ts`
Centralizes visit read-model errors.

Initial candidates:
- `VisitNotFoundError`
- `VisitForbiddenError`

These errors should be reusable by app adapters and package tests.

## Projection Rules

### Patient-safe projection rules
Patient-facing reads should expose only fields required for the patient portal experience.

Examples:
- request status
- request type
- scheduled time
- address
- care type
- safe assignment/timeline information already visible in the patient portal

They should not leak:
- back-office reassignment reasoning
- admin-only operational metadata
- raw nurse records

### Nurse-safe projection rules
Nurse-facing reads should expose only fields required to execute the visit.

Examples:
- assignment status
- address and routing coordinates if currently required by the nurse workflow
- care type
- timing fields needed for in-progress execution

They should not leak:
- admin-only audit metadata
- unrelated patient history not needed for the active assignment experience

### Internal mapping rule
Each projection module should own file-local mappers such as:
- `mapToPatientActiveVisit(...)`
- `mapToPatientVisitHistoryItem(...)`
- `mapToNurseActiveVisit(...)`
- `mapToVisitNotificationItem(...)`

No raw joined row should be returned from a public package function.

## Dependencies
The intended dependency direction is:

`apps/web -> domain-visit -> domain-request / domain-dispatch / database / contracts`

Notes:
- `domain-visit` reads data shaped by request and dispatch truth, but does not own those write paths
- `domain-visit` may depend on `@nurseconnect/contracts` for shared public types such as `RequestStatus`
- `domain-visit` may depend directly on `@nurseconnect/database` during the initial extraction phase
- this package should not depend on `@nurseconnect/platform-telemetry`

## What Stays In `apps/web`
The following remain app-layer responsibilities after Step 7:
- `apps/web/src/app/api/requests/mine/route.ts`
- `apps/web/src/app/api/requests/assigned/route.ts`
- `apps/web/src/app/api/requests/[id]/events/route.ts`
- `apps/web/src/app/api/me/notifications/route.ts`
- dashboard components and hooks
- polling intervals and refetch cadence
- transport-level cache semantics such as `304 Not Modified`
- read-audit instrumentation if compliance requires access logging

These should become thinner adapters over `@nurseconnect/domain-visit`.

## What Must Stay Out
This slice should explicitly avoid:
- no request action mutation extraction
- no dispatch assignment/reassignment extraction
- no nurse availability mutation logic
- no new visit or assignment schema redesign
- no admin request-detail page extraction
- no unread-notification product redesign
- no transport-level polling optimization work such as ETags or `304` handling

## Testing Strategy
The extraction should preserve three layers of verification:

1. Package unit tests
- visit-state helpers
- projection mappers
- actor visibility rules
- cursor pagination behavior

2. Existing API regression coverage
- `/api/requests/mine`
- `/api/requests/assigned`
- `/api/requests/[id]/events`
- `/api/me/notifications`

3. Existing dashboard/UI verification
- patient request card and timeline behavior
- nurse assignment card behavior
- any portal polling behavior that depends on active visit semantics

## Risks

### Risk 1: request and visit boundaries get blurred
Because the read side is built on request rows and request events, it is easy to pull write-side policy back into the visit package.

Mitigation:
- keep write primitives and transitions in `domain-request`
- keep assignment truth in `domain-dispatch`
- limit `domain-visit` to read semantics only

### Risk 2: raw rows leak through “temporary” helpers
Read-model packages often drift into returning raw selects during hurried route cutovers.

Mitigation:
- strict `index.ts` facade
- file-local safe-shape mappers
- explicit actor-safe projection rules

### Risk 3: performance regresses if history reads over-fetch
The current nurse assignment feed still fetches all rows and slices in memory.

Mitigation:
- active and history reads must be separate
- history reads must use DB limits
- cursor pagination should be designed in from the beginning

## Non-Goals
- no `domain-patient` package in this slice
- no mobile push/inbox redesign
- no read-audit compliance framework in the package
- no notification read/unread write model
- no change to public route payloads unless the existing UI already tolerates the same shape

## Outcome
This slice succeeds when:
- patient and nurse live visit reads no longer live directly inside app-local routes or request helper files
- active/history/timeline/notification semantics are centralized in `@nurseconnect/domain-visit`
- routes and dashboard consumers become thinner adapters over actor-safe projections
- request and dispatch write boundaries remain intact

That gives NurseConnect a dedicated home for the live care experience without forcing a schema rewrite or inventing patient-domain ownership too early.
