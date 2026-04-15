# Domain Nurse Extraction Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract nurse-domain policy and DB-backed nurse use cases into `@nurseconnect/domain-nurse` without changing nurse application, credential review, location update, or self-availability behavior.

**Architecture:** Create `@nurseconnect/domain-nurse` as the nurse-domain package, but keep request-state checks and HTTP transport in `apps/web`. Move nurse credential lifecycle, nurse record helpers, nurse-state-only availability policy, and location update rules into the package. Leave `/api/me/nurse` as a thin adapter that still composes the active-visit guard from request state before calling nurse-domain policy.

**Tech Stack:** pnpm workspaces, Turborepo, TypeScript, Next.js App Router, Drizzle/Postgres, Vitest, Playwright, `@nurseconnect/database`, `@nurseconnect/contracts`, and `@nurseconnect/platform-telemetry`

---

## File Structure

### New package files

- Create: `packages/domain-nurse/package.json`
- Create: `packages/domain-nurse/tsconfig.json`
- Create: `packages/domain-nurse/vitest.config.ts`
- Create: `packages/domain-nurse/src/index.ts`
- Create: `packages/domain-nurse/src/errors.ts`
- Create: `packages/domain-nurse/src/availability-policy.ts`
- Create: `packages/domain-nurse/src/availability-policy.test.ts`
- Create: `packages/domain-nurse/src/credential-lifecycle.ts`
- Create: `packages/domain-nurse/src/location-state.ts`
- Create: `packages/domain-nurse/src/nurse-record.ts`

### App adapters and shims

- Modify: `apps/web/src/server/admin/nurse-credentials.ts`
- Modify: `apps/web/src/server/admin/ops-dashboard.ts`
- Modify: `apps/web/src/server/nurse-location/update-my-location.ts`
- Modify: `apps/web/src/lib/nurse-record.ts`
- Modify: `apps/web/src/app/api/me/nurse/route.ts`
- Modify: `apps/web/src/app/api/me/become-nurse/route.ts`
- Modify: `apps/web/src/app/api/me/location/route.ts`
- Modify: `apps/web/src/app/api/admin/nurses/route.ts`
- Modify: `apps/web/src/app/api/admin/nurses/[id]/verify/route.ts`
- Modify: `apps/web/src/app/api/admin/nurses/[id]/reject/route.ts`
- Modify: `apps/web/src/app/api/admin/nurses/[id]/suspend/route.ts`
- Modify: `apps/web/src/app/admin/nurses/page.tsx`
- Modify: `apps/web/src/app/admin/nurses/[id]/page.tsx`

### Workspace wiring

- Modify: `package.json`

### Tests

- Modify: `apps/web/src/server/nurse-location/update-my-location.db.test.ts`
- Modify: `apps/web/src/server/auth/user-service.db.test.ts`
- Create: `apps/web/src/server/admin/nurse-credentials.db.test.ts`
- Modify: `apps/web/tests/e2e-api/admin-nurse-credentials.api.e2e.ts`
- Modify: `apps/web/tests/e2e-api/nurse.api.e2e.ts`

### Non-goals for this plan

- Do not move the active-visit query out of `apps/web/src/app/api/me/nurse/route.ts`
- Do not redesign admin availability override semantics in `apps/web/src/app/api/admin/nurses/[id]/availability/route.ts`
- Do not extract nurse UI components or dashboard presentation
- Do not move request allocation, reassignment, or request action logic

## Execution Strategy

- Use the dedicated worktree created from merged `main`.
- Keep the old app-local modules as thin adapters or re-exports while imports are updated.
- Write package-local tests for pure nurse policy before implementation.
- Keep DB-heavy verification in app-level Vitest and Playwright suites.
- Update root test wiring so `@nurseconnect/domain-nurse` participates in architecture/package verification.

## Chunk 1: Package Scaffolding and Pure Nurse Policy

### Task 1: Scaffold `@nurseconnect/domain-nurse`

**Files:**
- Create: `packages/domain-nurse/package.json`
- Create: `packages/domain-nurse/tsconfig.json`
- Create: `packages/domain-nurse/vitest.config.ts`
- Create: `packages/domain-nurse/src/index.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing package smoke test**

Create `packages/domain-nurse/src/availability-policy.test.ts` with a minimal import:

```ts
import { describe, expect, it } from "vitest";

import { assertCanSetSelfAvailability } from "./availability-policy";

describe("domain-nurse scaffold", () => {
  it("exports nurse availability policy", () => {
    expect(assertCanSetSelfAvailability).toBeTypeOf("function");
  });
});
```

- [ ] **Step 2: Run the package test and verify it fails**

Run:

```bash
pnpm --filter @nurseconnect/domain-nurse test
```

Expected: FAIL because the package does not exist yet.

- [ ] **Step 3: Create the package scaffold**

Use the current package pattern from:

- `packages/domain-identity/package.json`
- `packages/domain-request/package.json`

Required package name:

```json
{
  "name": "@nurseconnect/domain-nurse"
}
```

Root script update:

- append `pnpm --filter @nurseconnect/domain-nurse test` to `test:architecture`

- [ ] **Step 4: Run scaffold verification**

Run:

```bash
pnpm --filter @nurseconnect/domain-nurse test
pnpm type-check
```

Expected: PASS for the new package test and full workspace type-check.

- [ ] **Step 5: Commit**

```bash
git add package.json packages/domain-nurse
git commit -m "chore: scaffold domain nurse package"
```

### Task 2: Extract nurse errors and self-availability policy

**Files:**
- Create: `packages/domain-nurse/src/errors.ts`
- Create: `packages/domain-nurse/src/availability-policy.ts`
- Modify: `packages/domain-nurse/src/index.ts`
- Modify: `packages/domain-nurse/src/availability-policy.test.ts`
- Modify: `apps/web/src/app/api/me/nurse/route.ts`

- [ ] **Step 1: Write the failing policy tests**

Expand `packages/domain-nurse/src/availability-policy.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { NurseAvailabilityError, assertCanSetSelfAvailability } from "./availability-policy";

describe("assertCanSetSelfAvailability", () => {
  it("allows verified nurses with a valid license to go available", () => {
    expect(() =>
      assertCanSetSelfAvailability({
        status: "verified",
        licenseValidUntil: new Date("2027-12-31T00:00:00.000Z"),
      }),
    ).not.toThrow();
  });

  it("rejects non-verified nurses", () => {
    expect(() =>
      assertCanSetSelfAvailability({
        status: "submitted",
        licenseValidUntil: null,
      }),
    ).toThrow(NurseAvailabilityError);
  });

  it("rejects expired licenses", () => {
    expect(() =>
      assertCanSetSelfAvailability({
        status: "verified",
        licenseValidUntil: new Date("2020-01-01T00:00:00.000Z"),
      }),
    ).toThrow("license has expired");
  });
});
```

- [ ] **Step 2: Run the package test and verify it fails**

Run:

```bash
pnpm --filter @nurseconnect/domain-nurse test
```

Expected: FAIL because the policy and errors do not exist yet.

- [ ] **Step 3: Implement the minimal policy**

Create `errors.ts` and `availability-policy.ts` with:

- `NurseAvailabilityError`
- `assertCanSetSelfAvailability(input)`

`assertCanSetSelfAvailability` should reject:

- any status other than `verified`
- any expired `licenseValidUntil`

It should not query `service_requests`.

- [ ] **Step 4: Adapt `/api/me/nurse` to use the domain policy**

Keep these route responsibilities in place:

- auth/session resolution
- nurse profile lookup
- active-visit query
- HTTP and telemetry

Replace the existing inline verified/license checks with `assertCanSetSelfAvailability` when `isAvailable === true`.

- [ ] **Step 5: Run focused verification**

Run:

```bash
pnpm --filter @nurseconnect/domain-nurse test
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/nurse.api.e2e.ts --project=api
```

Expected: PASS. The active-visit 409 behavior must remain unchanged because it still lives in the route.

- [ ] **Step 6: Commit**

```bash
git add packages/domain-nurse apps/web/src/app/api/me/nurse/route.ts
git commit -m "feat: extract nurse availability policy"
```

## Chunk 2: Nurse Record and Location Extraction

### Task 3: Move nurse record helpers into `@nurseconnect/domain-nurse`

**Files:**
- Create: `packages/domain-nurse/src/nurse-record.ts`
- Modify: `packages/domain-nurse/src/index.ts`
- Modify: `apps/web/src/lib/nurse-record.ts`
- Modify: `apps/web/src/server/auth/user-service.db.test.ts`

- [ ] **Step 1: Write the failing DB test expectation**

In `apps/web/src/server/auth/user-service.db.test.ts`, keep the existing nurse-record assertions but switch the import target to `@nurseconnect/domain-nurse`.

- [ ] **Step 2: Run the DB test and verify it fails**

Run:

```bash
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec vitest -c vitest.config.node.ts run src/server/auth/user-service.db.test.ts
```

Expected: FAIL with missing export/module errors for `@nurseconnect/domain-nurse`.

- [ ] **Step 3: Implement `nurse-record.ts` and leave an app shim**

Move:

- `getNurseByUserId`
- `createNurseRecord`

into `packages/domain-nurse/src/nurse-record.ts`.

Replace `apps/web/src/lib/nurse-record.ts` with a thin re-export:

```ts
export { createNurseRecord, getNurseByUserId } from "@nurseconnect/domain-nurse";
```

- [ ] **Step 4: Run verification**

Run:

```bash
pnpm type-check
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec vitest -c vitest.config.node.ts run src/server/auth/user-service.db.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/domain-nurse apps/web/src/lib/nurse-record.ts apps/web/src/server/auth/user-service.db.test.ts
git commit -m "refactor: extract nurse record helpers"
```

### Task 4: Move nurse location state into `@nurseconnect/domain-nurse`

**Files:**
- Create: `packages/domain-nurse/src/location-state.ts`
- Modify: `packages/domain-nurse/src/index.ts`
- Modify: `apps/web/src/server/nurse-location/update-my-location.ts`
- Modify: `apps/web/src/server/nurse-location/update-my-location.db.test.ts`
- Modify: `apps/web/src/app/api/me/location/route.ts`

- [ ] **Step 1: Write the failing import shift**

Update `apps/web/src/server/nurse-location/update-my-location.db.test.ts` to import:

```ts
import { NurseLocationForbiddenError, updateMyNurseLocation } from "@nurseconnect/domain-nurse";
```

- [ ] **Step 2: Run the DB test and verify it fails**

Run:

```bash
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec vitest -c vitest.config.node.ts run src/server/nurse-location/update-my-location.db.test.ts
```

Expected: FAIL with missing export/module errors.

- [ ] **Step 3: Implement `location-state.ts` and leave an app shim**

Move:

- `NURSE_LOCATION_THROTTLE_SECONDS`
- `NurseLocationForbiddenError`
- `updateMyNurseLocation`

into `packages/domain-nurse/src/location-state.ts`.

Replace `apps/web/src/server/nurse-location/update-my-location.ts` with a thin re-export.

Update `apps/web/src/app/api/me/location/route.ts` to import from `@nurseconnect/domain-nurse` directly.

- [ ] **Step 4: Run verification**

Run:

```bash
pnpm type-check
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec vitest -c vitest.config.node.ts run src/server/nurse-location/update-my-location.db.test.ts
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/nurse.api.e2e.ts --project=api
```

Expected: PASS. Nurse location API behavior must not change.

- [ ] **Step 5: Commit**

```bash
git add packages/domain-nurse apps/web/src/server/nurse-location/update-my-location.ts apps/web/src/server/nurse-location/update-my-location.db.test.ts apps/web/src/app/api/me/location/route.ts
git commit -m "refactor: extract nurse location state"
```

## Chunk 3: Credential Lifecycle Extraction

### Task 5: Move nurse application and credential lifecycle into `@nurseconnect/domain-nurse`

**Files:**
- Create: `packages/domain-nurse/src/credential-lifecycle.ts`
- Modify: `packages/domain-nurse/src/index.ts`
- Modify: `apps/web/src/server/admin/nurse-credentials.ts`
- Modify: `apps/web/src/app/api/me/become-nurse/route.ts`
- Create: `apps/web/src/server/admin/nurse-credentials.db.test.ts`

- [ ] **Step 1: Write the failing DB integration test**

Create `apps/web/src/server/admin/nurse-credentials.db.test.ts` covering:

```ts
it("verifies a submitted nurse, promotes role, and records audit", async () => {
  // seed patient + submitted nurse
  // call verifyNurseCredential(...)
  // expect nurse.status === "verified"
  // expect user.role === "nurse"
  // expect audit log count === 1
});

it("rejects expired verification dates", async () => {
  // call verifyNurseCredential with past date
  // expect NurseCredentialValidationError
});

it("reject and suspend force isAvailable false", async () => {
  // call rejectNurseCredential / suspendNurseCredential
  // expect status changed and isAvailable false
});

it("submits a nurse application idempotently", async () => {
  // seed patient user
  // call submitNurseApplication twice with different credential values
  // expect one nurse row and latest submitted credential values
});
```

- [ ] **Step 2: Run the DB test and verify it fails**

Run:

```bash
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec vitest -c vitest.config.node.ts run src/server/admin/nurse-credentials.db.test.ts
```

Expected: FAIL because the package implementation and/or imports do not exist yet.

- [ ] **Step 3: Implement `credential-lifecycle.ts`**

Move the nurse credential functions from `apps/web/src/server/admin/nurse-credentials.ts` into the package, and add `submitNurseApplication` for the upsert logic currently in `apps/web/src/app/api/me/become-nurse/route.ts`.

Keep:

- direct `@nurseconnect/database` usage
- `recordAdminAction` from `@nurseconnect/platform-telemetry/admin-audit`

Leave `apps/web/src/server/admin/nurse-credentials.ts` as a re-export shim.

- [ ] **Step 4: Run verification**

Run:

```bash
pnpm type-check
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec vitest -c vitest.config.node.ts run src/server/admin/nurse-credentials.db.test.ts
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/admin-nurse-credentials.api.e2e.ts --project=api
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/nurse.api.e2e.ts --project=api
```

Expected: PASS. Applicant submission plus verify/reject/suspend flows must remain unchanged.

- [ ] **Step 5: Commit**

```bash
git add packages/domain-nurse apps/web/src/server/admin/nurse-credentials.ts apps/web/src/server/admin/nurse-credentials.db.test.ts
git commit -m "refactor: extract nurse credential lifecycle"
```

### Task 6: Adapt nurse routes to `@nurseconnect/domain-nurse`

**Files:**
- Modify: `apps/web/src/app/api/me/become-nurse/route.ts`
- Modify: `apps/web/src/app/api/admin/nurses/route.ts`
- Modify: `apps/web/src/app/api/admin/nurses/[id]/verify/route.ts`
- Modify: `apps/web/src/app/api/admin/nurses/[id]/reject/route.ts`
- Modify: `apps/web/src/app/api/admin/nurses/[id]/suspend/route.ts`
- Modify: `apps/web/src/server/admin/ops-dashboard.ts`
- Modify: `apps/web/src/app/admin/nurses/page.tsx`
- Modify: `apps/web/src/app/admin/nurses/[id]/page.tsx`

- [ ] **Step 1: Write the failing route import shift**

Update these routes to import from `@nurseconnect/domain-nurse` instead of the app-local shim.

- [ ] **Step 2: Run type-check and verify any missing export failures**

Run:

```bash
pnpm type-check
```

Expected: FAIL if any package exports are still missing.

- [ ] **Step 3: Complete route adaptation**

The routes should remain thin:

- `requireRole`
- `getSession` / identity projection where relevant
- payload parsing
- HTTP response formatting
- telemetry

Only the nurse business logic import changes.

- [ ] **Step 4: Run focused verification**

Run:

```bash
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/admin-nurse-credentials.api.e2e.ts tests/e2e-api/nurse.api.e2e.ts --project=api
pnpm --filter @nurseconnect/domain-nurse test
pnpm type-check
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/me/become-nurse/route.ts apps/web/src/app/api/admin/nurses/route.ts apps/web/src/app/api/admin/nurses/[id]/verify/route.ts apps/web/src/app/api/admin/nurses/[id]/reject/route.ts apps/web/src/app/api/admin/nurses/[id]/suspend/route.ts apps/web/src/server/admin/ops-dashboard.ts apps/web/src/app/admin/nurses/page.tsx apps/web/src/app/admin/nurses/[id]/page.tsx
git commit -m "refactor: adapt nurse routes to domain package"
```

## Final Verification

- [ ] **Step 1: Run end-to-end verification**

Run:

```bash
pnpm type-check
pnpm test:ci
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm test:api
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web build
```

Expected: PASS.

- [ ] **Step 2: Prepare branch for review**

If all checks pass, the branch is ready for PR review.
