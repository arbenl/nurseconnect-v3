# NurseConnect Domain Request Extraction

Date: 2026-04-15
Status: Proposed
Scope: Enterprise architecture Step 3 after merged `domain-nurse`

## Purpose

Define the `@nurseconnect/domain-request` extraction boundary so request business rules move out of `apps/web` without prematurely splitting the request and dispatch transaction seam.

This is an extraction spec, not a feature spec. The goal is to preserve current behavior while making request policy the authoritative concern of a dedicated package.

## Executive Summary

`@nurseconnect/domain-request` should own request-domain truth:

- request lifecycle and transition policy
- request creation invariants beyond transport-schema validation
- request-owned action rules
- request event append and event-payload rules
- request-specific domain errors

`apps/web` should remain the delivery and composition layer:

- HTTP transport and auth
- request-event read models and notification queries
- the atomic create-plus-assign transaction in `allocate-request.ts`
- dispatch and reassignment behavior
- cross-domain preconditions and cross-domain side-effect execution

This is a pure request-core extraction by design. It avoids breaking the current atomic `createAndAssignRequest()` flow before the dispatch seam is deliberately redesigned.

## Current Request Surface

The request domain is currently spread across these files:

- `packages/domain-request/src/request-lifecycle.ts`
- `packages/domain-request/src/request-events-write.ts`
- `apps/web/src/server/requests/request-actions.ts`
- `apps/web/src/server/requests/allocate-request.ts`
- `apps/web/src/server/requests/admin-reassign.ts`
- `apps/web/src/server/requests/request-events.ts`
- `apps/web/src/server/requests/admin-active-queue.ts`
- `apps/web/src/server/requests/triage-severity.ts`
- `packages/contracts/src/requests.ts`
- `packages/database/src/schema/service-requests.ts`
- `packages/database/src/schema/request-events.ts`

The request core is already partially extracted:

- `packages/domain-request/src/request-lifecycle.ts` owns `canTransition`
- `packages/domain-request/src/request-events-write.ts` owns the write-side `appendRequestEvent` primitive

The main remaining request-owned logic still lives in `apps/web/src/server/requests/request-actions.ts`.

## Core Decisions

### 1. Keep Request Core Separate From Dispatch

`@nurseconnect/domain-request` will own request policy and request-table writes, but it will not absorb dispatch in this step.

That means these stay outside the package for now:

- nearest nurse selection
- reassignment policy
- nurse availability consumption and release as a direct DB concern
- the atomic create-plus-assign transaction in `allocate-request.ts`

This is the most important risk boundary in the repo. `createAndAssignRequest()` is still one transaction with `FOR UPDATE SKIP LOCKED`. We should not split creation from assignment until `domain-dispatch` is designed explicitly.

### 2. `request-actions.ts` Returns Side-Effect Descriptors

`applyRequestAction` should move into `@nurseconnect/domain-request`, but it must not mutate the nurse table directly.

Instead, it should:

- lock and validate the request row
- enforce request-owned authorization and transition rules
- update `service_requests`
- append the request event
- return side-effect descriptors for cross-domain writes

Representative result shape:

```ts
export type RequestSideEffect =
  | { type: "set-nurse-availability"; userId: string; isAvailable: boolean };

{
  request,
  event,
  sideEffects: RequestSideEffect[]
}
```

`apps/web` continues to execute those side effects inside the existing transaction.

This is intentionally an extensible discriminated union, not a one-off object shape. Step 3 only needs the `set-nurse-availability` variant, but later extractions such as `domain-dispatch` may add their own side-effect variants without changing the executor pattern.

This keeps `domain-request` request-owned while preserving the current transaction behavior.

### 3. Nurse Profile Existence Stays Outside The Package

The current `applyRequestAction` also queries the `nurses` table to verify a nurse profile exists before nurse-owned actions are allowed.

That read is nurse-domain coupling, not request-domain truth.

For this extraction, `domain-request` should not query nurse state directly. The app adapter should resolve this cross-domain precondition first and pass it in:

```ts
actorHasNurseProfile: boolean
```

Then `domain-request` asserts the precondition instead of reading `nurses` itself.

### 4. `request-creation.ts` Owns Domain Invariants, Not Just Zod Re-exports

`packages/contracts/src/requests.ts` should remain the transport-schema layer.

`request-creation.ts` in `@nurseconnect/domain-request` must own the domain invariants that exist today and become the home for future request-creation policy.

Day-one invariants are the two rules currently embedded in `CreateRequestSchema.superRefine`:

- `scheduledFor` is required when `requestType === "scheduled"`
- `scheduledFor` must be omitted when `requestType === "same_day"`

Those rules should move out of `@nurseconnect/contracts` and into `request-creation.ts`.

After that move:

- `CreateRequestSchema` in `packages/contracts/src/requests.ts` becomes a pure transport shape
- `request-creation.ts` owns the request-domain creation invariants
- future request-creation policy, such as referral-field coherence or stricter scheduling rules, lands in `request-creation.ts`

It should not just wrap or re-export `CreateRequestSchema`.

## Target Package Shape

```text
packages/domain-request/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts
    errors.ts
    request-lifecycle.ts
    request-creation.ts
    request-actions.ts
    request-events.ts
```

Note:

- `request-lifecycle.ts` already exists and should remain the lifecycle module
- `request-events-write.ts` should be renamed or consolidated into `request-events.ts` inside `packages/domain-request` so the public shape matches the domain boundary more clearly
- `apps/web/src/server/requests/request-events.ts` remains the read-side module for timeline and notification queries

## Package Responsibilities

### `errors.ts`

Owns typed request-domain errors such as:

- `RequestNotFoundError`
- `RequestForbiddenError`
- `RequestConflictError`
- `RequestCreationValidationError`
- `RequestEventValidationError`

This centralizes errors that are currently duplicated or scattered across:

- `request-actions.ts`
- `request-events.ts`

Migration note:

- `RequestNotFoundError` moves into `@nurseconnect/domain-request/errors.ts`
- `apps/web/src/server/requests/admin-reassign.ts` should import `RequestNotFoundError` from the package instead of defining its own copy
- `RequestReassignForbiddenError` and `RequestReassignValidationError` stay in `admin-reassign.ts` because reassignment remains outside the request package in this step

### `request-lifecycle.ts`

Owns:

- valid request actions
- transition map
- transition guards
- request-status policy

This file already exists and should continue to be the single source of truth for request transitions.

### `request-creation.ts`

Owns request creation invariants beyond transport validation.

Initial responsibilities:

- take ownership of the two existing creation invariants currently implemented in `CreateRequestSchema.superRefine`
- validate the domain-level meaning of request creation input
- normalize request creation fields
- decide whether the input is coherent for persistence

Important note:

This module does not assign nurses. It only governs request creation as a request-domain concern.

### `request-actions.ts`

Owns request-owned action rules:

- `accept`
- `reject`
- `enroute`
- `complete`
- `cancel`

Responsibilities:

- validate the locked request state
- validate request-owned actor permissions
- compute the next request status
- shape request-table update payloads
- append the correct request event
- return side-effect descriptors for cross-domain writes

This module may continue to accept a `tx` parameter so request-table writes and event append remain transactional.

What it must not do in this step:

- query nurse state directly
- mutate the nurse table directly

### `request-events.ts`

Owns the write-side event append primitive and request-event payload rules.

This includes:

- append event
- validate allowed event metadata shape
- standardize event write behavior

This module is the write-side package module.

The app-layer file `apps/web/src/server/requests/request-events.ts` remains the read-side module and continues to own:

- `getRequestEventsForUser`
- `getNotificationsForActor`

That app-layer module may continue to re-export `appendRequestEvent` from `@nurseconnect/domain-request`, as it already does today, while read-side queries stay outside the package in this step.

## What Stays In `apps/web`

The following remain app-layer composition or read-side modules:

- `apps/web/src/server/requests/allocate-request.ts`
- `apps/web/src/server/requests/admin-reassign.ts`
- `apps/web/src/server/requests/request-events.ts` read-side functions
- `apps/web/src/server/requests/admin-active-queue.ts`
- `apps/web/src/server/requests/triage-severity.ts`
- request API routes that translate HTTP to domain calls

These modules continue to own:

- route auth and transport handling
- dispatch and reassignment
- admin audit for reassignment
- queue/read-model shaping
- cross-domain preconditions
- execution of returned side effects in a transaction

## Transaction Model

This extraction preserves the current transaction shape.

### Request actions

`domain-request` may:

- accept a `tx`
- update `service_requests`
- append request events

The app adapter may:

- resolve cross-domain preconditions such as `actorHasNurseProfile`
- call the domain action function
- execute any returned cross-domain side effects inside the same `tx`

### Request creation and assignment

`allocate-request.ts` remains the composed transaction:

1. create request
2. append `request_created`
3. select and lock candidate supply
4. assign nurse if possible
5. update nurse availability
6. append `request_assigned`

This step does not redesign that seam.

## Explicit Non-Goals

This extraction must not:

- split `createAndAssignRequest()` into separate request and dispatch transactions
- move nurse availability writes into `domain-request`
- move nurse-profile reads into `domain-request`
- absorb reassignment into the request package
- move admin queue/read-model logic
- change request behavior from the user’s point of view

## Testing Strategy

Use two layers:

### 1. Package-local unit tests

For pure request policy:

- request lifecycle
- request creation invariants
- request action side-effect descriptor shaping
- request event metadata validation

### 2. Existing app-level DB and API tests

For transactional behavior:

- `apps/web/src/server/requests/request-actions.db.test.ts`
- `apps/web/src/server/requests/allocate-request.db.test.ts`
- `apps/web/src/server/requests/request-events.db.test.ts`
- `apps/web/tests/e2e-api/requests.api.e2e.ts`
- `apps/web/tests/e2e-api/admin-request-reassign.api.e2e.ts`

These should prove that:

- request transitions are unchanged
- request events stay ordered and correct
- request-side event writes remain transactional
- side effects still execute correctly from the app layer

## Risks

### 1. Hidden Nurse Coupling In `request-actions.ts`

The current action flow reads and writes nurse state. If that coupling is moved casually into `domain-request`, the package boundary will become false.

### 2. Fake `request-creation.ts`

If `request-creation.ts` becomes only a wrapper over `CreateRequestSchema`, it adds ceremony without owning real business logic.

### 3. Premature Dispatch Leakage

If `allocate-request.ts` is split or partially absorbed during this step, the repo risks introducing race conditions and unclear ownership before `domain-dispatch` is designed.

### 4. Error Proliferation

Request-specific errors are currently duplicated across files. If this extraction does not centralize them cleanly, app adapters will keep reintroducing divergence.

## Success Criteria

This extraction is successful when:

- `@nurseconnect/domain-request` becomes the authoritative home for request lifecycle, creation invariants, action rules, and event writes
- `apps/web` request modules become thinner composition/read-side adapters
- request actions stop mutating or reading nurse state directly inside the request package
- the atomic request-plus-dispatch transaction remains intact until the dispatch step
- no user-visible behavior changes are introduced
