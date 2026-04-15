# Domain Request Extraction Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract request-domain creation rules, shared request errors, write-side request events, and request-owned action policy into `@nurseconnect/domain-request` without changing request creation, nurse accept/reject/enroute/complete flows, cancellation behavior, admin reassignment behavior, or the current atomic create-and-assign dispatch seam.

**Architecture:** Keep Step 3 as a pure request-core extraction. `@nurseconnect/domain-request` becomes the authoritative home for request lifecycle, request creation invariants, request-owned action rules, request-domain errors, and the write-side event append primitive. `apps/web` remains the composition layer: it keeps HTTP transport, auth, request-event read models, admin reassignment, and the atomic `createAndAssignRequest()` transaction. `request-actions` moves into the package but returns `RequestSideEffect[]`; the app adapter executes those cross-domain side effects inside the same `tx`. Nurse-profile existence stays an app-layer precondition (`actorHasNurseProfile`), not a package-owned nurse-table read.

**Tech Stack:** pnpm workspaces, Turborepo, TypeScript, Next.js App Router, Drizzle/Postgres, Vitest, Playwright, `@nurseconnect/database`, `@nurseconnect/contracts`, `@nurseconnect/platform-telemetry`, and `@nurseconnect/domain-request`

---

## File Structure

### Package files

- Create: `packages/domain-request/src/errors.ts`
- Create: `packages/domain-request/src/request-creation.ts`
- Create: `packages/domain-request/src/request-creation.test.ts`
- Create: `packages/domain-request/src/request-actions.ts`
- Create: `packages/domain-request/src/request-actions.test.ts`
- Create: `packages/domain-request/src/request-events.ts`
- Delete or replace: `packages/domain-request/src/request-events-write.ts`
- Modify: `packages/domain-request/src/index.ts`

### App adapters and request modules

- Modify: `apps/web/src/server/requests/allocate-request.ts`
- Modify: `apps/web/src/server/requests/request-actions.ts`
- Modify: `apps/web/src/server/requests/request-action-http.ts`
- Modify: `apps/web/src/server/requests/request-events.ts`
- Modify: `apps/web/src/server/requests/admin-reassign.ts`
- Modify: `apps/web/src/app/api/requests/route.ts`

### Contracts and shared tests

- Modify: `packages/contracts/src/requests.ts`
- Modify: `packages/contracts/test/unit/request.schema.test.ts`
- Modify: `apps/web/src/server/requests/allocate-request.db.test.ts`
- Modify: `apps/web/src/server/requests/request-actions.db.test.ts`
- Modify: `apps/web/src/server/requests/request-events.db.test.ts`
- Modify: `apps/web/tests/e2e-api/requests.api.e2e.ts`
- Modify: `apps/web/tests/e2e-api/admin-request-reassign.api.e2e.ts`

### Non-goals for this plan

- Do not split request creation away from nurse assignment
- Do not move `admin-reassign.ts` into `@nurseconnect/domain-request`
- Do not move request-event read-side queries out of `apps/web`
- Do not redesign admin queue, triage severity, or dashboard read models
- Do not introduce repository ports or a new dispatch abstraction in this slice

## Execution Strategy

- Start from a fresh dedicated worktree off merged `main`, not from the design branch.
- Preserve the current transaction seam in `createAndAssignRequest()`; Step 3 is request-core extraction only.
- Use package-local tests for pure request rules and domain exports.
- Use the existing web DB integration suites as the red/green harness for DB-backed request behavior.
- Keep app-local files as thin adapters or re-export shims while imports are updated.
- Move the two current `CreateRequestSchema.superRefine` rules into `request-creation.ts`; after that, contracts remain transport-only.
- Keep the request create API behavior-preserving by mapping `RequestCreationValidationError` to HTTP `400`.

## Chunk 1: Request Creation Invariants and Transport Contract Cleanup

### Task 1: Move request creation invariants out of contracts and into `@nurseconnect/domain-request`

**Files:**
- Create: `packages/domain-request/src/errors.ts`
- Create: `packages/domain-request/src/request-creation.ts`
- Create: `packages/domain-request/src/request-creation.test.ts`
- Modify: `packages/domain-request/src/index.ts`
- Modify: `packages/contracts/src/requests.ts`
- Modify: `packages/contracts/test/unit/request.schema.test.ts`
- Modify: `apps/web/src/server/requests/allocate-request.ts`
- Modify: `apps/web/src/server/requests/allocate-request.db.test.ts`
- Modify: `apps/web/src/app/api/requests/route.ts`

- [ ] **Step 1: Write the failing tests first**

Add `packages/domain-request/src/request-creation.test.ts` with the day-one domain invariants:

```ts
import { describe, expect, it } from "vitest";

import { RequestCreationValidationError } from "./errors";
import { assertCreateRequestInvariants } from "./request-creation";

describe("assertCreateRequestInvariants", () => {
  it("requires scheduledFor for scheduled requests", () => {
    expect(() =>
      assertCreateRequestInvariants({
        address: "123 Main Street",
        lat: 42.6629,
        lng: 21.1655,
        requestType: "scheduled",
      }),
    ).toThrow(RequestCreationValidationError);
  });

  it("rejects scheduledFor on same-day requests", () => {
    expect(() =>
      assertCreateRequestInvariants({
        address: "123 Main Street",
        lat: 42.6629,
        lng: 21.1655,
        requestType: "same_day",
        scheduledFor: "2027-01-01T10:00:00.000Z",
      }),
    ).toThrow("scheduledFor must be omitted for same-day requests");
  });
});
```

Update `packages/contracts/test/unit/request.schema.test.ts` so the same inputs now pass transport validation. This is deliberate: the red phase proves the `superRefine` rules are still in contracts and have not yet moved.

Add a new DB regression in `apps/web/src/server/requests/allocate-request.db.test.ts` that proves invalid request-shape combinations fail before persistence, for example:

- scheduled request without `scheduledFor`
- same-day request with a non-null `scheduledFor`

- [ ] **Step 2: Run the red phase**

Run:

```bash
pnpm --filter @nurseconnect/domain-request test
pnpm --filter contracts test
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec vitest -c vitest.config.node.ts run src/server/requests/allocate-request.db.test.ts
```

Expected:

- `domain-request` test fails because `errors.ts` and `request-creation.ts` do not exist yet
- contracts test fails because `CreateRequestSchema` still has the old `superRefine`
- DB test fails because `createAndAssignRequest()` does not yet enforce the new package invariant helper

- [ ] **Step 3: Implement the minimal request-creation extraction**

Implement:

- `packages/domain-request/src/errors.ts`
  - add `RequestCreationValidationError`
- `packages/domain-request/src/request-creation.ts`
  - export `assertCreateRequestInvariants(input)`
  - move the two current `superRefine` rules here
- `packages/domain-request/src/index.ts`
  - export `errors.ts` and `request-creation.ts`

Then update:

- `packages/contracts/src/requests.ts`
  - remove the `superRefine`
  - keep the schema transport-only
- `apps/web/src/server/requests/allocate-request.ts`
  - import `type CreateRequestInput` from `@nurseconnect/contracts` instead of maintaining a duplicate local shape
  - call `assertCreateRequestInvariants(input)` before the transaction begins
- `apps/web/src/app/api/requests/route.ts`
  - catch `RequestCreationValidationError`
  - return HTTP `400` rather than `500`

- [ ] **Step 4: Verify the creation path**

Run:

```bash
pnpm --filter @nurseconnect/domain-request test
pnpm --filter contracts test
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec vitest -c vitest.config.node.ts run src/server/requests/allocate-request.db.test.ts
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/requests.api.e2e.ts --project=api
```

Expected: all pass, and invalid request-shape combinations now fail via request-domain validation instead of contract-layer `superRefine`.

- [ ] **Step 5: Commit**

```bash
git add packages/domain-request packages/contracts apps/web/src/server/requests/allocate-request.ts apps/web/src/app/api/requests/route.ts apps/web/src/server/requests/allocate-request.db.test.ts apps/web/tests/e2e-api/requests.api.e2e.ts
git commit -m "feat: extract request creation invariants"
```

## Chunk 2: Shared Request Errors and Write-Side Event Consolidation

### Task 2: Move shared request errors into the package and rename the write-side event module

**Files:**
- Modify: `packages/domain-request/src/errors.ts`
- Create: `packages/domain-request/src/request-events.ts`
- Delete or replace: `packages/domain-request/src/request-events-write.ts`
- Modify: `packages/domain-request/src/index.ts`
- Modify: `apps/web/src/server/requests/request-events.ts`
- Modify: `apps/web/src/server/requests/admin-reassign.ts`
- Modify: `apps/web/tests/e2e-api/admin-request-reassign.api.e2e.ts`

- [ ] **Step 1: Write the failing export and error migration checks**

Extend `packages/domain-request/src/request-creation.test.ts` with a package-level smoke check for the shared error surface:

```ts
import { describe, expect, it } from "vitest";

import {
  RequestConflictError,
  RequestForbiddenError,
  RequestNotFoundError,
} from "./index";

describe("domain-request shared errors", () => {
  it("exports shared request errors", () => {
    expect(new RequestNotFoundError().name).toBe("RequestNotFoundError");
    expect(new RequestForbiddenError().name).toBe("RequestForbiddenError");
    expect(new RequestConflictError().name).toBe("RequestConflictError");
  });
});
```

Update `apps/web/tests/e2e-api/admin-request-reassign.api.e2e.ts` or the closest request-admin assertion path to keep exercising the not-found branch after `admin-reassign.ts` stops defining its own `RequestNotFoundError`.

- [ ] **Step 2: Run the red phase**

Run:

```bash
pnpm --filter @nurseconnect/domain-request test
pnpm type-check
```

Expected:

- package test fails because the shared request errors are not exported yet
- type-check may still reference `request-events-write.ts` and duplicate `RequestNotFoundError`

- [ ] **Step 3: Implement the shared error/event consolidation**

Update `packages/domain-request/src/errors.ts` to add:

- `RequestNotFoundError`
- `RequestForbiddenError`
- `RequestConflictError`
- `RequestEventValidationError`

Then:

- rename `request-events-write.ts` to `request-events.ts`
- keep `appendRequestEvent` there as the write-side primitive
- export it from `packages/domain-request/src/index.ts`
- update `apps/web/src/server/requests/request-events.ts`
  - keep only the read-side query functions
  - continue re-exporting `appendRequestEvent` from `@nurseconnect/domain-request`
- update `apps/web/src/server/requests/admin-reassign.ts`
  - import `RequestNotFoundError` from `@nurseconnect/domain-request`
  - keep `RequestReassignForbiddenError` and `RequestReassignValidationError` local

- [ ] **Step 4: Verify the shared surface**

Run:

```bash
pnpm --filter @nurseconnect/domain-request test
pnpm type-check
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/admin-request-reassign.api.e2e.ts --project=api
```

Expected: the package exports are stable, the app read-side module stays intact, and admin reassignment still returns the same not-found semantics.

- [ ] **Step 5: Commit**

```bash
git add packages/domain-request apps/web/src/server/requests/request-events.ts apps/web/src/server/requests/admin-reassign.ts apps/web/tests/e2e-api/admin-request-reassign.api.e2e.ts
git commit -m "refactor: consolidate request errors and events"
```

## Chunk 3: Request Action Policy Extraction With Side-Effect Descriptors

### Task 3: Move request-owned action policy into `@nurseconnect/domain-request` and keep the app file as the transaction adapter

**Files:**
- Create: `packages/domain-request/src/request-actions.ts`
- Modify: `packages/domain-request/src/index.ts`
- Modify: `apps/web/src/server/requests/request-actions.ts`
- Modify: `apps/web/src/server/requests/request-action-http.ts`
- Modify: `apps/web/src/server/requests/request-actions.db.test.ts`
- Modify: `apps/web/src/server/requests/request-events.db.test.ts`
- Modify: `packages/domain-request/src/request-actions.test.ts`

- [ ] **Step 1: Write the failing DB-first red phase**

Use the existing DB suites as the red phase for this extraction. This module remains DB-backed and transactional, so do not invent a fake unit-only seam just to satisfy the workflow.

First, add one missing regression to `apps/web/src/server/requests/request-actions.db.test.ts`:

- verify that canceling an assigned request makes the assigned nurse available again

Then add `packages/domain-request/src/request-actions.test.ts` to pin the side-effect union contract:

```ts
import { describe, expect, it } from "vitest";

import type { RequestSideEffect } from "./request-actions";

describe("RequestSideEffect", () => {
  it("supports nurse availability side effects", () => {
    const effect: RequestSideEffect = {
      type: "set-nurse-availability",
      userId: "00000000-0000-4000-8000-000000000000",
      isAvailable: false,
    };

    expect(effect.type).toBe("set-nurse-availability");
  });
});
```

Then update the test imports to reference the request-domain errors through `@nurseconnect/domain-request` rather than the app-local file. Keep `applyRequestAction` imported from the app-local adapter path so the public behavior remains what is being tested.

- [ ] **Step 2: Run the red phase**

Run:

```bash
pnpm --filter @nurseconnect/domain-request test
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec vitest -c vitest.config.node.ts run src/server/requests/request-actions.db.test.ts src/server/requests/request-events.db.test.ts
```

Expected:

- package or DB tests fail because `request-actions.ts` and `RequestSideEffect` do not exist yet
- the cancel regression is in place before the extraction starts

- [ ] **Step 3: Implement package-owned action policy**

Create `packages/domain-request/src/request-actions.ts` with:

- `export type RequestSideEffect =
  | { type: "set-nurse-availability"; userId: string; isAvailable: boolean };`
- `applyRequestAction(tx, input)`
  - accepts `actorHasNurseProfile: boolean`
  - locks the request row
  - enforces request-owned authz and transition rules
  - updates `service_requests`
  - appends the request event
  - returns `{ request, event, sideEffects }`

Important implementation rules:

- `domain-request` may write `service_requests` and `service_request_events`
- it must not query the nurse table directly
- it must not mutate the nurse table directly

Then adapt `apps/web/src/server/requests/request-actions.ts` into a thin adapter:

- open `db.transaction(...)`
- if the action is nurse-owned, resolve `actorHasNurseProfile` by querying `nurses` in the app layer
- call the package `applyRequestAction(tx, { ... actorHasNurseProfile })`
- execute returned `RequestSideEffect[]` inside the same transaction
- re-export the request-domain errors from the package so `request-action-http.ts` can keep its current shape

Update `apps/web/src/server/requests/request-action-http.ts` only as needed to import the moved errors from the request package or the re-exporting adapter.

- [ ] **Step 4: Verify request actions and event logging**

Run:

```bash
pnpm --filter @nurseconnect/domain-request test
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec vitest -c vitest.config.node.ts run src/server/requests/request-actions.db.test.ts src/server/requests/request-events.db.test.ts
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/requests.api.e2e.ts --project=api
```

Expected: nurse accept/reject/enroute/complete and patient cancel behavior remain unchanged, and the adapter still applies nurse-availability side effects within the transaction.

- [ ] **Step 5: Commit**

```bash
git add packages/domain-request apps/web/src/server/requests/request-actions.ts apps/web/src/server/requests/request-action-http.ts apps/web/src/server/requests/request-actions.db.test.ts apps/web/src/server/requests/request-events.db.test.ts apps/web/tests/e2e-api/requests.api.e2e.ts
git commit -m "feat: extract request action policy"
```

## Chunk 4: Final Verification and Publish Checkpoint

### Task 4: Run the full Step 3 verification set before opening implementation PR work

**Files:** no new files; verification only

- [ ] **Step 1: Run the package and contract suites**

```bash
pnpm --filter @nurseconnect/domain-request test
pnpm --filter contracts test
pnpm type-check
```

- [ ] **Step 2: Run the request DB integration suites**

```bash
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec vitest -c vitest.config.node.ts run src/server/requests/allocate-request.db.test.ts src/server/requests/request-actions.db.test.ts src/server/requests/request-events.db.test.ts
```

- [ ] **Step 3: Run the request-facing API E2E suites**

```bash
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/requests.api.e2e.ts tests/e2e-api/admin-request-reassign.api.e2e.ts --project=api
```

- [ ] **Step 4: Run the production build**

```bash
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web build
```

- [ ] **Step 5: Commit the finished extraction**

```bash
git add packages/domain-request packages/contracts apps/web/src/server/requests apps/web/src/app/api/requests/route.ts apps/web/tests/e2e-api/requests.api.e2e.ts apps/web/tests/e2e-api/admin-request-reassign.api.e2e.ts
git commit -m "refactor: extract request domain core"
```

## Expected End State

After this plan:

- `@nurseconnect/domain-request` owns request lifecycle, request creation invariants, request-domain errors, request-owned action policy, and the write-side request event primitive
- `@nurseconnect/contracts` is transport-only for request creation shape
- `apps/web/src/server/requests/request-actions.ts` is only a transaction adapter and side-effect executor
- `apps/web/src/server/requests/request-events.ts` remains read-side only
- `admin-reassign.ts` still stays outside the package but no longer duplicates `RequestNotFoundError`
- `createAndAssignRequest()` remains atomic and still owns dispatch composition

## Risks and Guardrails

- The highest-risk seam remains `createAndAssignRequest()`. Do not split creation from assignment in this plan.
- Keep nurse-table reads and writes outside `@nurseconnect/domain-request`. The package can own request tables; the app layer still composes cross-domain behavior.
- Do not let request-creation validation live in both contracts and the package. The whole point is to remove duplication.
- Do not move read-side request timelines or notification queries in this step. Those belong to later read-model cleanup, not Step 3.
