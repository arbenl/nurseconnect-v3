## Purpose
Define the `@nurseconnect/domain-dispatch` extraction boundary so dispatch policy moves out of `apps/web` without prematurely redesigning the data model around the existing `assignments` table.

This is an extraction spec, not a dispatch redesign spec. The goal is to preserve current behavior while making dispatch policy the authoritative concern of a dedicated package.

## Executive Summary
`@nurseconnect/domain-dispatch` should own dispatch-domain truth:
- candidate selection from eligible nurse supply
- automatic assignment policy
- manual assignment and reassignment policy
- nurse availability consumption and release as a dispatch concern
- dispatch event shaping for `request_assigned` and `request_reassigned`
- dispatch-specific validation and authorization errors

`apps/web` should remain the delivery and composition layer:
- HTTP transport and auth
- app-layer transaction composition
- admin audit writes
- request-event read models and notification queries
- admin queue and dashboard read projections
- the current `service_requests.assigned_nurse_user_id` storage model

This step preserves the existing dispatch model by design. It does not migrate dispatch writes onto the `assignments` table.

## Current Dispatch Surface
- `apps/web/src/server/requests/allocate-request.ts`
- `apps/web/src/server/requests/admin-reassign.ts`
- `apps/web/src/server/requests/request-events.ts`
- `packages/domain-request/src/request-events.ts`
- `apps/web/src/server/requests/allocate-request.db.test.ts`
- `apps/web/tests/e2e-api/admin-request-reassign.api.e2e.ts`
- `apps/web/tests/e2e-api/requests.api.e2e.ts`
- `packages/database/src/schema/service-requests.ts`
- `packages/database/src/schema/assignments.ts`
- `packages/database/src/schema/visits.ts`

The current dispatch model is still centered on `service_requests.assigned_nurse_user_id` and `service_requests.assigned_at`.

The repo already contains `assignments` and `visits` tables, but the current dispatch flow does not use them as the authoritative write model.

## Core Decisions

### 1. Preserve the current dispatch storage model
Step 4 will preserve the current dispatch write model:
- assignment lives on `service_requests.assigned_nurse_user_id`
- dispatch timestamps live on `service_requests.assigned_at`
- request status moves between `open` and `assigned` at the dispatch layer

This step does not:
- dual-write to `assignments`
- migrate read paths to `assignments`
- redefine accepted/completed work around `assignments` or `visits`

That redesign can happen later from a stable extracted baseline.

### 2. `domain-dispatch` writes nurse availability directly
`domain-request` returns nurse-availability side-effect descriptors because nurse availability is incidental to request actions.

`domain-dispatch` should not use that indirection for its core assignment paths.

Dispatch exists to consume and release nurse supply. Therefore `@nurseconnect/domain-dispatch` should write nurse availability directly:
- set `nurses.is_available = false` on assignment
- set `nurses.is_available = true` when reassignment or unassignment releases supply

That is dispatch truth, not a cross-domain side effect.

### 3. `domain-dispatch` depends on `domain-request` for request-event writes
Dispatch must emit:
- `request_assigned`
- `request_reassigned`

The authoritative request-event write primitive already lives in `@nurseconnect/domain-request`.

So the dependency direction should be:

`apps/web -> domain-dispatch -> domain-request -> contracts/database`

This is intentional and safe:
- `domain-dispatch` writes into the request event timeline
- `domain-request` does not depend on dispatch

`@nurseconnect/domain-dispatch` should use `appendRequestEvent` from `@nurseconnect/domain-request` rather than duplicating request-event insertion logic.

### 4. `apps/web` keeps the outer transaction boundary
Step 4 does not move the composed outer transaction into a package.

`apps/web` should continue to own:
- `db.transaction(...)`
- transport and auth
- calling request and dispatch domain functions in sequence
- admin audit writes

This preserves the existing atomic create-and-assign behavior and avoids introducing a new orchestration abstraction during extraction.

### 5. No-candidate behavior remains non-throwing in automatic dispatch
Current create-and-assign behavior does not throw when no nurses are available.

It creates the request and leaves it `open`.

Step 4 should preserve that behavior:
- `candidate-selection.ts` returns a candidate or `null`
- the caller decides what to do with `null`
- in the create flow, `null` means “leave request open”

`DispatchCandidateNotFoundError` may still exist in the package for future flows that require a match, but automatic create-and-assign should keep the current return-`null` behavior.

### 6. Lock ownership is split by concern
The locking model should stay explicit:

- `candidate-selection.ts`
  - locks nurse supply rows through `FOR UPDATE SKIP LOCKED`
  - lock target: `nurse_locations`

- `assignment-policy.ts`
  - does not own a request-row lock
  - receives a request context from the caller

- `reassignment-policy.ts`
  - owns the request-row `FOR UPDATE` lock
  - lock target: `service_requests`

This is consistent with current behavior:
- create-and-assign already owns the newly inserted request in the same transaction
- manual assignment of an existing open request must lock/load the request in the app adapter before calling `assignment-policy`
- reassignment owns demand-side validation and therefore owns the request lock

## Target Package Shape

```plain text
packages/domain-dispatch/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts
    errors.ts
    candidate-selection.ts
    assignment-policy.ts
    reassignment-policy.ts
```

Notes:
- this package is policy-first, not route-first
- helper functions may exist internally, but the public shape should stay centered on the three dispatch entry points

## Package Responsibilities

### `errors.ts`
Owns dispatch-specific errors such as:
- `DispatchValidationError`
- `DispatchCandidateNotFoundError`
- `ReassignmentForbiddenError`
- `ReassignmentValidationError`

`RequestNotFoundError` should continue to come from `@nurseconnect/domain-request` because request existence is request truth, not dispatch truth.

### `candidate-selection.ts`
Owns nurse supply selection for automatic dispatch.

Responsibilities:
- read eligible supply from `nurse_locations`, `nurses`, and `users`
- filter supply to dispatchable nurses only
- lock supply rows with `FOR UPDATE SKIP LOCKED`
- compute haversine distance
- apply deterministic ordering
- return the best candidate or `null`

This module does not:
- write `service_requests`
- write audit logs
- throw when no candidate exists in the automatic assignment flow

### `assignment-policy.ts`
Owns assignment writes and dispatch-side supply consumption.

Responsibilities:
- accept a request context from the caller
- validate the target nurse for assignment when the caller bypasses candidate selection
- write assignment fields on `service_requests`
- write `nurses.is_available = false`
- append `request_assigned`

Fields it owns on `service_requests`:
- `assignedNurseUserId`
- `assignedAt`
- `status: "assigned"` for the assignment transition
- `updatedAt`

This module does not:
- own a request-row lock
- create the request
- write admin audit logs

Two intended call patterns:
- automatic dispatch: `candidate-selection -> assignment-policy`
- direct manual assign of an existing open request: app adapter locks request first, then calls `assignment-policy`

### `reassignment-policy.ts`
Owns reassignment and unassignment policy.

Responsibilities:
- lock the request row with `FOR UPDATE`
- validate that the request can be reassigned
- validate target nurse eligibility when assigning
- release previous nurse supply when needed
- assign or unassign the target nurse
- append `request_reassigned`

Fields it owns on `service_requests`:
- `assignedNurseUserId`
- `assignedAt`
- dispatch-side `status` transitions between `open` and `assigned`
- `updatedAt`

It also owns nurse supply release/consumption during reassignment:
- previous nurse becomes available when released
- new nurse becomes unavailable when assigned

This module does not:
- write admin audit logs
- own read-side admin queue shaping

## Shared `service_requests` Boundary
During Step 4, `domain-request` and `domain-dispatch` intentionally share one table with different column concerns.

### `domain-request` owns
- request creation invariants
- request lifecycle transitions after dispatch
- request action timestamps such as `acceptedAt`, `enrouteAt`, `completedAt`, `canceledAt`, `rejectedAt`
- request-domain errors and write-side request events

### `domain-dispatch` owns
- assignment fields (`assignedNurseUserId`, `assignedAt`)
- dispatch-side `open <-> assigned` transitions
- nurse availability writes tied to assignment and reassignment
- dispatch event payloads for `request_assigned` and `request_reassigned`

### Shared fields
- both packages may write `updatedAt`

This shared-table boundary is intentional for Step 4.

It resolves later when the dispatch model moves toward the dedicated `assignments` table.

## What Stays In `apps/web`
The following remain app-layer modules after Step 4:
- `apps/web/src/server/requests/allocate-request.ts`
- `apps/web/src/server/requests/admin-reassign.ts`
- `apps/web/src/server/requests/request-events.ts` read-side functions
- `apps/web/src/server/requests/admin-active-queue.ts`
- `apps/web/src/server/requests/triage-severity.ts`
- request and admin API routes

These stay outside the package because they own:
- HTTP transport
- auth
- app-layer transaction composition
- admin audit calls
- read-side projections
- request-event timeline queries and notifications

## Transaction Model

### Automatic create-and-assign flow
`apps/web/src/server/requests/allocate-request.ts` should remain the composed transaction:

1. open `db.transaction(...)`
2. create the request row
3. append `request_created`
4. call `candidate-selection.ts`
5. if no candidate, return request as `open`
6. if candidate exists, call `assignment-policy.ts`
7. return the assigned request

The outer transaction remains in `apps/web`.

### Manual admin assignment flow
If an admin assigns an open request directly:

1. app adapter opens `db.transaction(...)`
2. app adapter locks/loads the open request row
3. app adapter calls `assignment-policy.ts`
4. app adapter records admin audit

This keeps `assignment-policy.ts` free of request-lock ownership while still supporting direct manual assignment.

### Manual reassignment/unassignment flow
For existing assigned requests:

1. app adapter opens `db.transaction(...)`
2. app adapter calls `reassignment-policy.ts`
3. app adapter records admin audit

Here, the dispatch package owns the request lock because reassignment logic depends on current request state.

## Explicit Non-Goals
This extraction must not:
- migrate dispatch writes to the `assignments` table
- dual-write dispatch state to both `service_requests` and `assignments`
- move request lifecycle actions back out of `@nurseconnect/domain-request`
- move admin audit into `@nurseconnect/domain-dispatch`
- move read-side queue or dashboard logic into the dispatch package
- redesign visits
- change user-visible dispatch behavior

## Testing Strategy

### 1. Package-local tests
Use package tests for:
- deterministic candidate ordering
- no-candidate returns `null`
- assignment-policy field shaping
- reassignment-policy validation and release/assign decisions
- dispatch error exports

### 2. Existing app-level DB and API tests
Use existing DB and API suites for transactional proof:
- `apps/web/src/server/requests/allocate-request.db.test.ts`
- `apps/web/tests/e2e-api/requests.api.e2e.ts`
- `apps/web/tests/e2e-api/admin-request-reassign.api.e2e.ts`
- any admin request queue or request-event DB tests affected by dispatch extraction

These should prove that:
- nearest-nurse assignment behavior is unchanged
- no-supply requests still remain open
- reassignment keeps nurse availability coherent
- dispatch events remain correct
- admin audit still happens from the app layer

## Risks

### 1. Hidden data-model redesign
The biggest risk is letting Step 4 drift into an `assignments`-table redesign. That would make the slice too large and mix extraction with workflow migration.

### 2. False purity around nurse availability
If nurse availability is treated like an external side effect instead of dispatch truth, the dispatch package will become needlessly indirect and harder to reason about.

### 3. Blurred request ownership
If dispatch starts owning request lifecycle beyond assignment state, `domain-request` will lose its authority and the package boundaries will regress.

### 4. Lock ambiguity
If manual assignment paths do not lock the request before calling `assignment-policy`, the extraction can silently weaken correctness under concurrency.

## Success Criteria
This extraction is successful when:
- `@nurseconnect/domain-dispatch` becomes the authoritative home for candidate selection, assignment, and reassignment policy
- `apps/web` dispatch modules become thinner transport/orchestration adapters
- request-event writes still flow through `@nurseconnect/domain-request`
- nurse availability writes become explicit dispatch behavior inside the dispatch package
- the current `service_requests`-based dispatch model remains behavior-preserving
- no user-visible regression is introduced

## Status
- Draft approved in conversation on April 16, 2026.
- The next step after user review is the implementation plan for Step 4.
