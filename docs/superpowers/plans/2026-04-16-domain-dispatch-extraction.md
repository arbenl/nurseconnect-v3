# Domain Dispatch Extraction Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract candidate selection, assignment policy, and reassignment policy into `@nurseconnect/domain-dispatch` without changing the current `service_requests.assigned_nurse_user_id` dispatch model, the atomic create-and-assign transaction, admin reassignment behavior, or request-event semantics.

**Architecture:** Keep Step 4 as a behavior-preserving extraction. `@nurseconnect/domain-dispatch` becomes the authoritative home for dispatch candidate selection, assignment writes, reassignment/unassignment rules, nurse availability writes, and dispatch-specific errors. `apps/web` remains the composition layer: it keeps HTTP/auth, the outer transaction boundary, admin audit writes, and read-side projections. `@nurseconnect/domain-dispatch` depends on `@nurseconnect/domain-request` for `appendRequestEvent`, while both packages temporarily share `service_requests` with separate column concerns.

**Tech Stack:** pnpm workspaces, Turborepo, TypeScript, Next.js App Router, Drizzle/Postgres, Vitest, Playwright, `@nurseconnect/database`, `@nurseconnect/contracts`, `@nurseconnect/domain-request`, and the new `@nurseconnect/domain-dispatch`

---

## File Structure

### New package scaffold

- Create: `packages/domain-dispatch/package.json`
- Create: `packages/domain-dispatch/tsconfig.json`
- Create: `packages/domain-dispatch/vitest.config.ts`
- Create: `packages/domain-dispatch/src/index.ts`
- Create: `packages/domain-dispatch/src/errors.ts`
- Create: `packages/domain-dispatch/src/candidate-selection.ts`
- Create: `packages/domain-dispatch/src/candidate-selection.test.ts`
- Create: `packages/domain-dispatch/src/assignment-policy.ts`
- Create: `packages/domain-dispatch/src/assignment-policy.test.ts`
- Create: `packages/domain-dispatch/src/reassignment-policy.ts`
- Create: `packages/domain-dispatch/src/reassignment-policy.test.ts`

### App adapters and dispatch entry points

- Modify: `apps/web/src/server/requests/allocate-request.ts`
- Modify: `apps/web/src/server/requests/admin-reassign.ts`

### Existing regression harness

- Modify: `apps/web/src/server/requests/allocate-request.db.test.ts`
- Modify: `apps/web/src/server/requests/request-events.db.test.ts`
- Modify: `apps/web/tests/e2e-api/requests.api.e2e.ts`
- Modify: `apps/web/tests/e2e-api/admin-request-reassign.api.e2e.ts`

### Deliberate non-goals for this plan

- Do not migrate or dual-write to `packages/database/src/schema/assignments.ts`
- Do not move the outer `db.transaction(...)` boundary out of `apps/web`
- Do not move admin audit into `@nurseconnect/domain-dispatch`
- Do not move request-event read-side queries out of `apps/web`
- Do not redesign visits or queue/read models
- Do not change `request_reassigned` semantics for the existing admin reassignment route

## Execution Strategy

- Start from a fresh dedicated worktree off merged `main`, not from the design branch.
- Preserve the current `service_requests`-based dispatch model.
- Let `@nurseconnect/domain-dispatch` write nurse availability directly; do not introduce `RequestSideEffect[]` indirection here.
- Reuse `appendRequestEvent` from `@nurseconnect/domain-request`; do not duplicate request-event inserts.
- Keep `RequestNotFoundError` in `@nurseconnect/domain-request`.
- Keep direct-manual nurse eligibility logic in `assignment-policy.ts`, but do not activate a new app adapter for that path in Step 4. The current admin route still goes through reassignment logic so it continues to emit `request_reassigned`.
- Keep reassignment-specific errors in `@nurseconnect/domain-dispatch`, and let `apps/web/src/server/requests/admin-reassign.ts` remain the thin adapter that adds `recordAdminAction(...)`.
- Use package-local Vitest coverage for pure dispatch rules and helper exports.
- Use the existing DB and API tests as the proof that create-and-assign, no-supply behavior, request events, and admin reassignment remain unchanged.

## Chunk 1: Scaffold `@nurseconnect/domain-dispatch` and Extract Candidate Selection

### Task 1: Create the package and move nurse-supply candidate selection into it

**Files:**
- Create: `packages/domain-dispatch/package.json`
- Create: `packages/domain-dispatch/tsconfig.json`
- Create: `packages/domain-dispatch/vitest.config.ts`
- Create: `packages/domain-dispatch/src/index.ts`
- Create: `packages/domain-dispatch/src/errors.ts`
- Create: `packages/domain-dispatch/src/candidate-selection.ts`
- Create: `packages/domain-dispatch/src/candidate-selection.test.ts`
- Modify: `apps/web/src/server/requests/allocate-request.ts`
- Modify: `apps/web/src/server/requests/allocate-request.db.test.ts`
- Modify: `apps/web/tests/e2e-api/requests.api.e2e.ts`

- [ ] **Step 1: Create the package scaffold and write the failing candidate-selection tests**

Create the package scaffold by copying the shape used by `packages/domain-request`:

```json
// packages/domain-dispatch/package.json
{
  "name": "@nurseconnect/domain-dispatch",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "type-check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run --config vitest.config.ts"
  },
  "dependencies": {
    "@nurseconnect/contracts": "workspace:*",
    "@nurseconnect/database": "workspace:*",
    "@nurseconnect/domain-request": "workspace:*",
    "drizzle-orm": "^0.40.0"
  },
  "devDependencies": {
    "@types/node": "^20.19.11",
    "typescript": "^5.9.2",
    "vitest": "^3.2.4"
  }
}
```

Add `packages/domain-dispatch/src/candidate-selection.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { pickDispatchCandidate } from "./candidate-selection";

describe("pickDispatchCandidate", () => {
  it("returns null when no candidate rows exist", () => {
    expect(pickDispatchCandidate([], { lat: 42.6629, lng: 21.1655 })).toBeNull();
  });

  it("chooses the nearest candidate", () => {
    const picked = pickDispatchCandidate(
      [
        { nurseUserId: "nurse-b", lat: "43.000000", lng: "21.000000" },
        { nurseUserId: "nurse-a", lat: "42.662901", lng: "21.165501" },
      ],
      { lat: 42.6629, lng: 21.1655 },
    );

    expect(picked?.nurseUserId).toBe("nurse-a");
  });

  it("breaks equal-distance ties by nurse user id", () => {
    const picked = pickDispatchCandidate(
      [
        { nurseUserId: "nurse-z", lat: "42.700000", lng: "21.200000" },
        { nurseUserId: "nurse-a", lat: "42.700000", lng: "21.200000" },
      ],
      { lat: 42.6629, lng: 21.1655 },
    );

    expect(picked?.nurseUserId).toBe("nurse-a");
  });
});
```

Extend `apps/web/src/server/requests/allocate-request.db.test.ts` with an explicit no-supply regression that still expects the request to remain `open`, and a nearest-candidate regression that still expects the nearest verified nurse to win after the extraction.

- [ ] **Step 2: Install workspace dependencies for the new package**

Run:

```bash
pnpm install
```

Expected: the workspace lockfile and dependency graph now include `@nurseconnect/domain-dispatch`, so subsequent `pnpm --filter` commands can resolve the new package.

- [ ] **Step 3: Run the red phase**

Run:

```bash
pnpm --filter @nurseconnect/domain-dispatch test
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec vitest -c vitest.config.node.ts run src/server/requests/allocate-request.db.test.ts
```

Expected:

- package test fails because `pickDispatchCandidate` is not implemented yet
- web DB test still reflects the old inline selection code and the new package is unused

- [ ] **Step 4: Implement candidate selection and wire it into `allocate-request.ts`**

Implement `packages/domain-dispatch/src/candidate-selection.ts` with two layers:

```ts
type CandidateRow = {
  nurseUserId: string;
  lat: string;
  lng: string;
};

export function pickDispatchCandidate(
  rows: CandidateRow[],
  origin: { lat: number; lng: number },
) {
  // Compute haversine distance, sort by meters, break ties by nurseUserId.
}

export async function selectDispatchCandidate(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  origin: { lat: number; lng: number },
) {
  // Keep the current SQL filter and `FOR UPDATE OF nl SKIP LOCKED`.
  // Return the winner or null.
}
```

Keep the current eligibility filter inside the SQL query:
- `n.is_available = true`
- `u.role = 'nurse'`
- `n.status = 'verified'`
- `license_valid_until IS NULL OR > NOW()`

Update `apps/web/src/server/requests/allocate-request.ts`:
- remove the inline `compareCandidates(...)` helper
- stop doing inline candidate SQL and sorting
- call `selectDispatchCandidate(tx, { lat, lng })`
- preserve the current `null` behavior: if no candidate exists, return the newly-created request as `open`

Export `candidate-selection.ts` and `errors.ts` from `packages/domain-dispatch/src/index.ts`.

- [ ] **Step 5: Verify candidate selection remains behavior-preserving**

Run:

```bash
pnpm --filter @nurseconnect/domain-dispatch test
pnpm type-check
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec vitest -c vitest.config.node.ts run src/server/requests/allocate-request.db.test.ts
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/requests.api.e2e.ts --project=api
```

Expected: package tests pass, nearest-nurse selection is unchanged, and no-supply requests still remain `open`.

- [ ] **Step 6: Commit**

```bash
git add packages/domain-dispatch apps/web/src/server/requests/allocate-request.ts apps/web/src/server/requests/allocate-request.db.test.ts apps/web/tests/e2e-api/requests.api.e2e.ts
git commit -m "feat: extract dispatch candidate selection"
```

## Chunk 2: Extract Assignment Policy Into the Create-and-Assign Flow

### Task 2: Move assignment writes and nurse-availability consumption into `assignment-policy.ts`

**Files:**
- Create: `packages/domain-dispatch/src/assignment-policy.ts`
- Create: `packages/domain-dispatch/src/assignment-policy.test.ts`
- Modify: `packages/domain-dispatch/src/index.ts`
- Modify: `apps/web/src/server/requests/allocate-request.ts`
- Modify: `apps/web/src/server/requests/request-events.db.test.ts`
- Modify: `apps/web/src/server/requests/allocate-request.db.test.ts`

- [ ] **Step 1: Write the failing assignment-policy tests**

Add `packages/domain-dispatch/src/assignment-policy.test.ts` to lock the manual-eligibility rules into the package:

```ts
import { describe, expect, it } from "vitest";

import { DispatchValidationError } from "./errors";
import { assertDispatchEligibleNurse } from "./assignment-policy";

describe("assertDispatchEligibleNurse", () => {
  it("rejects a non-nurse role", () => {
    expect(() =>
      assertDispatchEligibleNurse({
        userExists: true,
        role: "patient",
        nurseExists: false,
        nurseStatus: null,
        licenseValidUntil: null,
      }),
    ).toThrow(DispatchValidationError);
  });

  it("rejects an unverified nurse", () => {
    expect(() =>
      assertDispatchEligibleNurse({
        userExists: true,
        role: "nurse",
        nurseExists: true,
        nurseStatus: "submitted",
        licenseValidUntil: null,
      }),
    ).toThrow("Target nurse is not verified");
  });

  it("rejects an expired license", () => {
    expect(() =>
      assertDispatchEligibleNurse({
        userExists: true,
        role: "nurse",
        nurseExists: true,
        nurseStatus: "verified",
        licenseValidUntil: "2020-01-01T00:00:00.000Z",
      }),
    ).toThrow("Target nurse license has expired");
  });
});
```

Extend `apps/web/src/server/requests/request-events.db.test.ts` if needed so it still proves automatic allocation emits `request_assigned` with the same metadata shape after `allocate-request.ts` stops writing the assignment inline.

- [ ] **Step 2: Run the red phase**

Run:

```bash
pnpm --filter @nurseconnect/domain-dispatch test
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec vitest -c vitest.config.node.ts run src/server/requests/allocate-request.db.test.ts src/server/requests/request-events.db.test.ts
```

Expected:

- `assignment-policy` package tests fail because the helper and module do not exist
- app tests are still exercising the old inline assignment logic

- [ ] **Step 3: Implement `assignment-policy.ts` and delegate from `allocate-request.ts`**

Implement `packages/domain-dispatch/src/assignment-policy.ts` with:

```ts
export function assertDispatchEligibleNurse(input: {
  userExists: boolean;
  role: "patient" | "nurse" | "admin" | null;
  nurseExists: boolean;
  nurseStatus: string | null;
  licenseValidUntil: Date | string | null;
}) {
  // Throw DispatchValidationError for invalid manual targets.
}

export async function assignRequestToNurse(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: {
    request: typeof schema.serviceRequests.$inferSelect;
    nurseUserId: string;
    skipEligibilityValidation: boolean;
  },
) {
  // Optionally validate nurse eligibility.
  // Update service_requests assignment fields.
  // Set nurses.isAvailable = false.
  // Append request_assigned through appendRequestEvent.
  // Return the updated request row.
}
```

Important constraints:
- `assignRequestToNurse(...)` owns assignment fields and nurse availability writes
- it does not open its own transaction
- it does not record admin audit
- current app adapters only call it with `skipEligibilityValidation: true` after `candidate-selection.ts`
- the direct-manual validation branch lands in the package now, but it is not activated by a new route in Step 4

Update `apps/web/src/server/requests/allocate-request.ts`:
- after `selectDispatchCandidate(...)`, call `assignRequestToNurse(tx, { request: req, nurseUserId: chosen.nurseUserId, skipEligibilityValidation: true })`
- remove the inline `service_requests` assignment update
- remove the inline `nurses.isAvailable = false` write
- remove the inline `appendRequestEvent(... request_assigned ...)`

- [ ] **Step 4: Verify the automatic assignment path**

Run:

```bash
pnpm --filter @nurseconnect/domain-dispatch test
pnpm type-check
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec vitest -c vitest.config.node.ts run src/server/requests/allocate-request.db.test.ts src/server/requests/request-events.db.test.ts
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/requests.api.e2e.ts --project=api
```

Expected: automatic dispatch still assigns the nearest nurse, still marks that nurse unavailable, and still emits the same `request_assigned` event payload.

- [ ] **Step 5: Commit**

```bash
git add packages/domain-dispatch apps/web/src/server/requests/allocate-request.ts apps/web/src/server/requests/allocate-request.db.test.ts apps/web/src/server/requests/request-events.db.test.ts
git commit -m "feat: extract dispatch assignment policy"
```

## Chunk 3: Extract Reassignment Policy Behind the Existing Admin Adapter

### Task 3: Move request-row locking, reassignment rules, and supply release/consumption into `reassignment-policy.ts`

**Files:**
- Create: `packages/domain-dispatch/src/reassignment-policy.ts`
- Create: `packages/domain-dispatch/src/reassignment-policy.test.ts`
- Modify: `packages/domain-dispatch/src/errors.ts`
- Modify: `packages/domain-dispatch/src/index.ts`
- Modify: `apps/web/src/server/requests/admin-reassign.ts`
- Modify: `apps/web/tests/e2e-api/admin-request-reassign.api.e2e.ts`
- Modify: `apps/web/src/server/requests/request-events.db.test.ts`

- [ ] **Step 1: Write the failing reassignment-policy tests**

Add `packages/domain-dispatch/src/reassignment-policy.test.ts` around a pure decision helper such as `deriveReassignmentPlan(...)`:

```ts
import { describe, expect, it } from "vitest";

import { deriveReassignmentPlan } from "./reassignment-policy";

describe("deriveReassignmentPlan", () => {
  it("assigns an open request to a nurse", () => {
    expect(
      deriveReassignmentPlan({
        currentStatus: "open",
        previousNurseUserId: null,
        nextNurseUserId: "nurse-1",
      }),
    ).toMatchObject({
      nextStatus: "assigned",
      shouldReleasePreviousNurse: false,
      shouldAssignNewNurse: true,
    });
  });

  it("reassigns from one nurse to another", () => {
    expect(
      deriveReassignmentPlan({
        currentStatus: "assigned",
        previousNurseUserId: "nurse-1",
        nextNurseUserId: "nurse-2",
      }),
    ).toMatchObject({
      nextStatus: "assigned",
      shouldReleasePreviousNurse: true,
      shouldAssignNewNurse: true,
    });
  });

  it("unassigns an assigned request", () => {
    expect(
      deriveReassignmentPlan({
        currentStatus: "assigned",
        previousNurseUserId: "nurse-1",
        nextNurseUserId: null,
      }),
    ).toMatchObject({
      nextStatus: "open",
      shouldReleasePreviousNurse: true,
      shouldAssignNewNurse: false,
    });
  });
});
```

Extend `apps/web/tests/e2e-api/admin-request-reassign.api.e2e.ts` if needed so it continues to assert:
- open request + nurse assignment still emits `request_reassigned`
- assigned request + new nurse still emits `request_reassigned`
- unassign still emits `request_reassigned`
- nurse availability remains coherent across the three operations

- [ ] **Step 2: Run the red phase**

Run:

```bash
pnpm --filter @nurseconnect/domain-dispatch test
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/admin-request-reassign.api.e2e.ts --project=api
```

Expected:

- package test fails because `deriveReassignmentPlan` and the package errors do not exist
- API suite still reflects the old inline admin-reassign implementation

- [ ] **Step 3: Implement `reassignment-policy.ts` and thin the app adapter**

Implement `packages/domain-dispatch/src/reassignment-policy.ts` with:

```ts
export function deriveReassignmentPlan(input: {
  currentStatus: "open" | "assigned";
  previousNurseUserId: string | null;
  nextNurseUserId: string | null;
}) {
  // Return nextStatus, whether to release previous supply,
  // whether to consume new supply, and whether assignedAt refreshes.
}

export async function reassignRequestInDispatch(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: {
    requestId: string;
    actorUserId: string;
    nurseUserId: string | null;
  },
) {
  // Lock service_requests FOR UPDATE.
  // Validate current status is open or assigned.
  // Validate target nurse eligibility when nurseUserId !== null.
  // Reuse assertDispatchEligibleNurse(...) from assignment-policy.ts.
  // Apply assignment/unassignment updates to service_requests.
  // Toggle nurse availability directly.
  // Append request_reassigned through appendRequestEvent.
  // Return { request, previousNurseUserId, previousStatus, nextStatus }.
}
```

This reuse is intentional: `reassignment-policy.ts` depends on `assignment-policy.ts` for nurse dispatch-eligibility validation so the package keeps one authoritative rule for nurse existence, verified status, and license validity.

Update `packages/domain-dispatch/src/errors.ts` to add:
- `RequestReassignForbiddenError`
- `RequestReassignValidationError`

Then update `apps/web/src/server/requests/admin-reassign.ts` so it becomes a thin adapter:
- keep the exported `reassignRequest(...)` name
- open `db.transaction(...)`
- call `reassignRequestInDispatch(tx, ...)`
- keep `recordAdminAction(...)` in the adapter, not in the package
- re-export or forward the reassignment errors from `@nurseconnect/domain-dispatch`

Important behavior note:
- keep the current admin route on `reassignment-policy.ts` for open-request assignment as well as reassignment/unassignment
- do **not** reroute the admin adapter through `assignment-policy.ts` in this slice, because the current API and activity feed intentionally emit `request_reassigned` for admin-initiated open-request assignment

- [ ] **Step 4: Run the full Step 4 regression suite**

Run:

```bash
pnpm --filter @nurseconnect/domain-dispatch test
pnpm type-check
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec vitest -c vitest.config.node.ts run src/server/requests/allocate-request.db.test.ts src/server/requests/request-events.db.test.ts src/server/requests/request-actions.db.test.ts
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/requests.api.e2e.ts tests/e2e-api/admin-request-reassign.api.e2e.ts --project=api
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web build
```

Expected:

- package tests pass
- create-and-assign remains atomic and behavior-preserving
- request actions still work on assigned requests after dispatch extraction
- admin reassignment still emits `request_reassigned`
- admin audit still comes from `apps/web`
- build passes with the new package wired in

- [ ] **Step 5: Commit**

```bash
git add packages/domain-dispatch apps/web/src/server/requests/admin-reassign.ts apps/web/tests/e2e-api/admin-request-reassign.api.e2e.ts apps/web/src/server/requests/request-events.db.test.ts apps/web/src/server/requests/request-actions.db.test.ts
git commit -m "feat: extract dispatch reassignment policy"
```

## Final Handoff Checklist

- [ ] `@nurseconnect/domain-dispatch` exists and exports candidate selection, assignment policy, reassignment policy, and dispatch errors
- [ ] `allocate-request.ts` is a thinner app-layer transaction orchestrator
- [ ] `admin-reassign.ts` is a thinner adapter that still records admin audit locally
- [ ] request-event writes still flow through `@nurseconnect/domain-request`
- [ ] no-supply requests still remain `open`
- [ ] admin open-request assignment still emits `request_reassigned`
- [ ] nurse availability remains coherent across automatic assignment and reassignment
- [ ] no `assignments` table migration was introduced

Plan complete and saved to `docs/superpowers/plans/2026-04-16-domain-dispatch-extraction.md`. Ready to execute?
