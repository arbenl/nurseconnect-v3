# Domain Nurse Self-Serve Boundary Completion Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining nurse self-serve seam so `@nurseconnect/domain-nurse` owns self-application submission and self-availability mutation, while `apps/web` remains the thin transport and cross-domain orchestration layer.

**Architecture:** Treat this as a boundary-completion slice inside the existing `domain-nurse` package, not as a new top-level domain. The package gains a new self-serve surface for `submitOwnNurseApplication(...)` and `setMyAvailability(...)`, while `apps/web` keeps auth, telemetry, HTTP formatting, and the active-visit `409` conflict check. `/api/me/location` remains untouched as the already-correct reference adapter, and `/api/profile` stays frozen as legacy compatibility only.

**Tech Stack:** pnpm workspaces, Turborepo, TypeScript, Next.js App Router, Drizzle/Postgres, Vitest, Playwright, `@nurseconnect/database`, `@nurseconnect/domain-nurse`, `@nurseconnect/domain-identity`, and `@nurseconnect/contracts`

---

## File Structure

### Package files to create or expand

- Modify: `packages/domain-nurse/package.json`
- Create: `packages/domain-nurse/vitest.db.config.ts`
- Create: `packages/domain-nurse/src/self-service.ts`
- Create: `packages/domain-nurse/src/self-service.test.ts`
- Create: `packages/domain-nurse/src/self-service.db.test.ts`
- Modify: `packages/domain-nurse/src/index.ts`
- Modify: `packages/domain-nurse/src/credential-lifecycle.ts`

### Route adapters to cut over

- Modify: `apps/web/src/app/api/me/become-nurse/route.ts`
- Modify: `apps/web/src/app/api/me/nurse/route.ts`
- Modify: `apps/web/src/app/api/profile/route.ts`

### Regression coverage to update

- Modify: `apps/web/tests/e2e-api/nurse.api.e2e.ts`
- Modify: `apps/web/tests/e2e-api/admin-nurse-credentials.api.e2e.ts`
- Modify: `pnpm-lock.yaml`

### Deliberate non-goals for this plan

- Do not modify `apps/web/src/app/api/me/location/route.ts`
- Do not modify `packages/domain-nurse/src/location-state.ts`
- Do not redesign admin nurse verification/rejection/suspension flows
- Do not move the active-visit query into `@nurseconnect/domain-nurse`
- Do not create a renewal workflow
- Do not change dashboard UX or `/api/me` payload shape

## Execution Strategy

- Start from the existing dedicated design worktree branch, not from a new feature worktree yet.
- Split `@nurseconnect/domain-nurse` tests the same way `domain-identity` is already split:
  - `test` stays unit-only
  - `test:db` holds DB-backed self-service tests
- Introduce a new `self-service.ts` entry surface rather than making the routes call the generic credential lifecycle helper directly.
- Keep the old generic submission helper only if the resulting boundary is still clear; prefer making the broad upsert helper package-internal once the self-serve wrapper exists.
- Add the new verified-nurse resubmission guard first at the package level, then cut the self-serve route over.
- Move nurse availability persistence into the package second, but keep the active-visit `409` check in `apps/web`.
- Treat `/api/profile` as a tiny legacy-freeze change at the end of the slice so it cannot sprawl into profile-domain work.
- Extend the existing API E2E suite before claiming the route cutover is complete.

## Chunk 1: Add `domain-nurse` Self-Serve Submission Policy

### Task 1: Add package test split, state-gated self-service submission, and verified-supply protection

**Files:**
- Modify: `packages/domain-nurse/package.json`
- Create: `packages/domain-nurse/vitest.db.config.ts`
- Create: `packages/domain-nurse/src/self-service.ts`
- Create: `packages/domain-nurse/src/self-service.test.ts`
- Create: `packages/domain-nurse/src/self-service.db.test.ts`
- Modify: `packages/domain-nurse/src/index.ts`
- Modify: `packages/domain-nurse/src/credential-lifecycle.ts`

- [ ] **Step 1: Add unit and DB test scaffolding for the new self-service surface**

Update `packages/domain-nurse/package.json`:

```json
{
  "scripts": {
    "type-check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run --config vitest.config.ts",
    "test:db": "vitest run --config vitest.db.config.ts"
  }
}
```

Create `packages/domain-nurse/vitest.db.config.ts`:

```ts
/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.db.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
```

Create `packages/domain-nurse/src/self-service.test.ts` with a pure state-gate helper test:

```ts
import { describe, expect, it } from "vitest";

import {
  NurseCredentialValidationError,
  assertCanSubmitOwnNurseApplication,
} from "./self-service";

describe("assertCanSubmitOwnNurseApplication", () => {
  it("allows no existing status and in-progress applicant statuses", () => {
    expect(() => assertCanSubmitOwnNurseApplication(null)).not.toThrow();
    expect(() => assertCanSubmitOwnNurseApplication("draft")).not.toThrow();
    expect(() => assertCanSubmitOwnNurseApplication("submitted")).not.toThrow();
  });

  it("rejects admin-owned and supply-protected statuses", () => {
    expect(() => assertCanSubmitOwnNurseApplication("verified")).toThrow(
      NurseCredentialValidationError,
    );
    expect(() => assertCanSubmitOwnNurseApplication("under_review")).toThrow(
      /not allowed/i,
    );
    expect(() => assertCanSubmitOwnNurseApplication("suspended")).toThrow(
      /not allowed/i,
    );
  });
});
```

Create `packages/domain-nurse/src/self-service.db.test.ts` with DB-backed cases:
- create a submitted application when no nurse row exists
- allow resubmission when status is `submitted`
- reject resubmission when status is `verified`
- confirm the verified row remains `verified` after the rejection

- [ ] **Step 2: Run the red phase for the new self-service tests**

Run:

```bash
pnpm --filter @nurseconnect/domain-nurse test
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter @nurseconnect/domain-nurse run test:db
```

Expected:
- unit tests fail because `self-service.ts` and `assertCanSubmitOwnNurseApplication(...)` do not exist
- DB tests fail because `submitOwnNurseApplication(...)` does not exist

- [ ] **Step 3: Implement the minimal self-service state gate and submission API**

Create `packages/domain-nurse/src/self-service.ts`:

```ts
import { db, eq, schema } from "@nurseconnect/database";

import { NurseCredentialValidationError } from "./errors";

const SELF_SERVE_ALLOWED_STATUSES = new Set(["draft", "submitted"] as const);

export function assertCanSubmitOwnNurseApplication(status: string | null) {
  if (status === null) return;
  if (SELF_SERVE_ALLOWED_STATUSES.has(status as "draft" | "submitted")) return;

  throw new NurseCredentialValidationError(
    `Self-service nurse application is not allowed while status is ${status}`,
  );
}

export async function submitOwnNurseApplication(input: {
  userId: string;
  licenseNumber: string;
  licenseJurisdiction: string;
  specialization: string;
}) {
  const now = new Date();
  const existing = await db.query.nurses.findFirst({
    where: eq(schema.nurses.userId, input.userId),
  });

  assertCanSubmitOwnNurseApplication(existing?.status ?? null);

  if (!existing) {
    await db.insert(schema.nurses).values({
      userId: input.userId,
      status: "submitted",
      licenseNumber: input.licenseNumber,
      licenseJurisdiction: input.licenseJurisdiction,
      specialization: input.specialization,
      isAvailable: false,
      updatedAt: now,
    });
  } else {
    await db
      .update(schema.nurses)
      .set({
        status: "submitted",
        licenseNumber: input.licenseNumber,
        licenseJurisdiction: input.licenseJurisdiction,
        specialization: input.specialization,
        isAvailable: false,
        updatedAt: now,
      })
      .where(eq(schema.nurses.userId, input.userId));
  }

  return db.query.nurses.findFirst({
    where: eq(schema.nurses.userId, input.userId),
  });
}
```

Update `packages/domain-nurse/src/index.ts` to export:

```ts
export {
  assertCanSubmitOwnNurseApplication,
  submitOwnNurseApplication,
} from "./self-service";
```

If `submitNurseApplication(...)` remains in `credential-lifecycle.ts`, add a comment making it admin/support/internal rather than self-serve route policy.

- [ ] **Step 4: Run the package tests to verify the new policy passes**

Run:

```bash
pnpm --filter @nurseconnect/domain-nurse test
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter @nurseconnect/domain-nurse run test:db
```

Expected:
- unit tests pass
- DB tests pass

- [ ] **Step 5: Commit the self-service submission policy**

```bash
git add packages/domain-nurse/package.json \
  packages/domain-nurse/vitest.db.config.ts \
  packages/domain-nurse/src/self-service.ts \
  packages/domain-nurse/src/self-service.test.ts \
  packages/domain-nurse/src/self-service.db.test.ts \
  packages/domain-nurse/src/index.ts \
  packages/domain-nurse/src/credential-lifecycle.ts \
  pnpm-lock.yaml
git commit -m "feat: add nurse self-serve submission policy"
```

## Chunk 2: Move Nurse Availability Mutation Into `domain-nurse`

### Task 2: Add package-owned availability mutation and keep the active-visit conflict in `apps/web`

**Files:**
- Modify: `packages/domain-nurse/src/self-service.ts`
- Modify: `packages/domain-nurse/src/self-service.db.test.ts`
- Modify: `packages/domain-nurse/src/index.ts`
- Modify: `apps/web/src/app/api/me/nurse/route.ts`

- [ ] **Step 1: Add the failing DB tests for availability mutation**

Extend `packages/domain-nurse/src/self-service.db.test.ts` with cases like:
- `setMyAvailability(...)` throws a missing-profile package failure when no nurse row exists
- unverified nurse cannot set availability `true`
- expired verified nurse cannot set availability `true`
- verified nurse can set availability `true` and then `false`

Use explicit assertions against the `nurses` row after each update.

- [ ] **Step 2: Run the red phase for availability mutation**

Run:

```bash
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter @nurseconnect/domain-nurse run test:db
```

Expected:
- DB tests fail because `setMyAvailability(...)` does not exist

- [ ] **Step 3: Implement `setMyAvailability(...)` in the package**

Extend `packages/domain-nurse/src/self-service.ts`:

```ts
import { assertCanSetSelfAvailability } from "./availability-policy";
import { NurseAvailabilityError } from "./errors";

export async function setMyAvailability(input: {
  actorUserId: string;
  isAvailable: boolean;
}) {
  const nurse = await db.query.nurses.findFirst({
    where: eq(schema.nurses.userId, input.actorUserId),
  });

  if (!nurse) {
    throw new NurseAvailabilityError("Nurse profile not found");
  }

  if (input.isAvailable) {
    assertCanSetSelfAvailability({
      status: nurse.status,
      licenseValidUntil: nurse.licenseValidUntil,
    });
  }

  await db
    .update(schema.nurses)
    .set({
      isAvailable: input.isAvailable,
      updatedAt: new Date(),
    })
    .where(eq(schema.nurses.userId, input.actorUserId));

  return db.query.nurses.findFirst({
    where: eq(schema.nurses.userId, input.actorUserId),
  });
}
```

Update `packages/domain-nurse/src/index.ts`:

```ts
export {
  assertCanSubmitOwnNurseApplication,
  setMyAvailability,
  submitOwnNurseApplication,
} from "./self-service";
```

- [ ] **Step 4: Run package tests again**

Run:

```bash
pnpm --filter @nurseconnect/domain-nurse test
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter @nurseconnect/domain-nurse run test:db
```

Expected:
- all package unit and DB tests pass

- [ ] **Step 5: Commit the availability mutation extraction**

```bash
git add packages/domain-nurse/src/self-service.ts \
  packages/domain-nurse/src/self-service.db.test.ts \
  packages/domain-nurse/src/index.ts
git commit -m "feat: extract nurse self availability mutation"
```

## Chunk 3: Cut Over Routes and Extend Regression Coverage

### Task 3: Move the routes onto the package, freeze `/api/profile`, and verify the self-serve seam end to end

**Files:**
- Modify: `apps/web/src/app/api/me/become-nurse/route.ts`
- Modify: `apps/web/src/app/api/me/nurse/route.ts`
- Modify: `apps/web/src/app/api/profile/route.ts`
- Modify: `apps/web/tests/e2e-api/nurse.api.e2e.ts`
- Modify: `apps/web/tests/e2e-api/admin-nurse-credentials.api.e2e.ts`

- [ ] **Step 1: Add the failing API regression coverage before route cutover**

Extend `apps/web/tests/e2e-api/nurse.api.e2e.ts` with:
- a verified nurse cannot resubmit `/api/me/become-nurse`
- the nurse row remains `verified` after the failed resubmission

Suggested test shape:

```ts
test("verified nurse cannot self-submit back to applicant state", async ({ request }) => {
  const email = `verified-resubmit-${Date.now()}@test.local`;
  const { userId } = await createTestUser(request, email, "Verified Nurse", "nurse");
  await seedNurse({
    userId,
    status: "verified",
    licenseNumber: "RN-VERIFIED-LOCKED",
    specialization: "ICU",
    isAvailable: true,
    licenseJurisdiction: "CA",
    licenseValidUntil: "2027-12-31T00:00:00.000Z",
  });
  await loginTestUser(request, email);

  const response = await request.post("/api/me/become-nurse", {
    data: {
      licenseNumber: "RN-NEW",
      licenseJurisdiction: "NY",
      specialization: "Emergency",
    },
  });

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toMatchObject({
    error: expect.stringMatching(/not allowed/i),
  });
});
```

Add one admin flow assertion in `apps/web/tests/e2e-api/admin-nurse-credentials.api.e2e.ts` that verified admin-side review still works after the self-serve boundary change.

- [ ] **Step 2: Run the red phase for the route-level change**

Run:

```bash
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/nurse.api.e2e.ts tests/e2e-api/admin-nurse-credentials.api.e2e.ts --project=api
```

Expected:
- the new verified-resubmit API test fails against the old route behavior

- [ ] **Step 3: Cut `/api/me/become-nurse` over to `submitOwnNurseApplication(...)`**

Update `apps/web/src/app/api/me/become-nurse/route.ts`:

```ts
import { submitOwnNurseApplication } from "@nurseconnect/domain-nurse";
```

Replace the current write call:

```ts
await submitOwnNurseApplication({
  userId: user.id,
  licenseNumber,
  licenseJurisdiction,
  specialization,
});
```

Add explicit domain error mapping:

```ts
if (error instanceof NurseCredentialValidationError) {
  const response = NextResponse.json({ error: error.message }, { status: 400 });
  logApiFailure(actorContextWithRole, error, 400, startedAt, {
    source: "me.becomeNurse",
  });
  return withRequestId(response, context.requestId);
}
```

- [ ] **Step 4: Cut `/api/me/nurse` over to `setMyAvailability(...)` while preserving the active-visit `409`**

Update `apps/web/src/app/api/me/nurse/route.ts`:
- keep auth/session resolution
- keep the active assignment query before enabling availability
- replace the direct `db.update(schema.nurses)` block with:

```ts
await setMyAvailability({
  actorUserId: user.id,
  isAvailable,
});
```

Keep the current `409 Conflict: Nurse has an active visit` response in the route adapter.

Map package-level failures cleanly:

```ts
if (error instanceof NurseAvailabilityError) {
  const status = error.message === "Nurse profile not found" ? 404 : 403;
  const response = NextResponse.json({ error: error.message }, { status });
  ...
}
```

- [ ] **Step 5: Freeze `/api/profile` explicitly as legacy compatibility**

Update `apps/web/src/app/api/profile/route.ts` with an explicit comment block like:

```ts
// Legacy compatibility adapter for the diagnostic /profile page only.
// Business profile ownership lives in /api/me and /api/me/profile via @nurseconnect/domain-identity.
// Do not add new profile mutation logic here.
```

No behavior change beyond clearer boundary documentation.

- [ ] **Step 6: Run the focused regression suite**

Run:

```bash
pnpm --filter @nurseconnect/domain-nurse test
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter @nurseconnect/domain-nurse run test:db
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/nurse.api.e2e.ts tests/e2e-api/admin-nurse-credentials.api.e2e.ts --project=api
pnpm type-check
```

Expected:
- package tests pass
- nurse/admin API E2E passes
- workspace type-check passes

- [ ] **Step 7: Run final build and live verification**

Run:

```bash
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web build
```

Then manually verify in a live browser:
- applicant submits `/api/me/become-nurse` successfully
- verified nurse cannot self-submit back into applicant state
- verified nurse can toggle availability when unassigned
- verified nurse still gets blocked with `409` while actively assigned
- legacy `/profile` page still loads as read-only diagnostics

- [ ] **Step 8: Commit the route cutover and regression coverage**

```bash
git add apps/web/src/app/api/me/become-nurse/route.ts \
  apps/web/src/app/api/me/nurse/route.ts \
  apps/web/src/app/api/profile/route.ts \
  apps/web/tests/e2e-api/nurse.api.e2e.ts \
  apps/web/tests/e2e-api/admin-nurse-credentials.api.e2e.ts
git commit -m "refactor: complete nurse self-serve boundary"
```

## Final Verification

- [ ] **Step 1: Run the publish-quality verification bundle**

Run:

```bash
pnpm --filter @nurseconnect/domain-nurse test
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter @nurseconnect/domain-nurse run test:db
pnpm type-check
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/nurse.api.e2e.ts tests/e2e-api/admin-nurse-credentials.api.e2e.ts --project=api
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web build
```

Expected:
- all commands pass

- [ ] **Step 2: Prepare PR summary notes**

Document for the PR:
- verified supply can no longer be demoted through `/api/me/become-nurse`
- self-availability mutation is package-owned now
- active-visit conflict remains app-composed by design
- `/api/profile` stayed legacy/read-only

## Notes for the Implementing Agent

- Preserve current external behavior unless the approved spec explicitly changes it.
- Do not let the self-serve route become a stealth renewal workflow.
- Do not move the active-assignment query into `@nurseconnect/domain-nurse` in this slice.
- If existing admin tests or fixtures depend on the old generic submission helper, keep the boundary explicit rather than breaking test setup blindly:
  - either keep the generic helper package-internal with a clearer name
  - or migrate those callers deliberately
- If the browser UI exposes copy derived from the returned error text, prefer clean human-readable domain error messages over route-specific strings.
