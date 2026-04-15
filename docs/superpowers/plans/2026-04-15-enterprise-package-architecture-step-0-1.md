# Enterprise Package Architecture Step 0 and Step 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract shared foundations and domain-identity into reusable workspace packages without changing user-visible behavior or breaking current auth, request, or admin flows.

**Architecture:** Start with pragmatic extraction, not purity. Create `@nurseconnect/platform-telemetry`, `@nurseconnect/domain-request`, and `@nurseconnect/domain-identity` as new workspace packages, but allow them to import `@nurseconnect/database` directly during the first move. Keep Better-Auth, `next/headers`, `NextResponse`, canonical route mapping, and page/API transport wiring in `apps/web`; only business policy and shared write-side primitives move.

**Tech Stack:** pnpm workspaces, Turborepo, TypeScript, Next.js App Router, Better-Auth, Drizzle/Postgres, Vitest, Playwright, workspace packages `@nurseconnect/database`, `@nurseconnect/contracts`, and `@nurseconnect/ui`

---

## File Structure

### New packages

- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/platform-telemetry/package.json`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/platform-telemetry/tsconfig.json`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/platform-telemetry/src/index.ts`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/platform-telemetry/src/admin-audit.ts`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/platform-telemetry/src/ops-logger.ts`

- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-request/package.json`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-request/tsconfig.json`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-request/src/index.ts`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-request/src/request-lifecycle.ts`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-request/src/request-events-write.ts`

- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-identity/package.json`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-identity/tsconfig.json`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-identity/src/index.ts`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-identity/src/errors.ts`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-identity/src/user-projection.ts`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-identity/src/session-user.ts`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-identity/src/require-role.ts`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-identity/src/portal-access-policy.ts`

### Interim app shims and adapters

- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/admin/audit.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/telemetry/ops-logger.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/requests/request-lifecycle.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/requests/request-events.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/auth/index.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/auth/session-user.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/auth/require-role.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/auth/portal-access.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/lib/user-service.ts`
- Create: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/lib/nurse-record.ts`

### Package and root wiring

- Modify: `/Users/arbenlila/development/nurseconnect-v3/package.json`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/turbo.json`

### Tests

- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-request/src/request-lifecycle.test.ts`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-identity/src/require-role.test.ts`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-identity/src/portal-access-policy.test.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/auth/user-service.db.test.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/auth/require-role.db.test.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/auth/user-role.db.test.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/requests/request-events.db.test.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/requests/request-lifecycle.test.ts`

### Non-goals for this plan

- Do not extract `get-session.ts`, `auth/http.ts`, or `canonical-routes.ts` out of `apps/web`
- Do not refactor allocation, reassignment, or request actions into `domain-dispatch` yet
- Do not introduce repository port abstractions beyond what is needed to keep Step 0 and Step 1 stable
- Do not start `domain-nurse` extraction in this plan

## Execution Strategy

- Use a dedicated worktree for execution.
- Keep old app-local files as thin re-export or adapter layers until imports are fully updated.
- Prefer package-local unit tests for pure policy and app-local DB tests for integration-heavy behavior.
- Update root scripts so the new package tests actually run in CI-oriented local verification.

## Chunk 1: Workspace Scaffolding and Shared Foundations

### Task 1: Create workspace package scaffolds

**Files:**
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/platform-telemetry/package.json`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/platform-telemetry/tsconfig.json`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/platform-telemetry/src/index.ts`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-request/package.json`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-request/tsconfig.json`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-request/src/index.ts`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-identity/package.json`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-identity/tsconfig.json`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-identity/src/index.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/package.json`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/turbo.json`

- [ ] **Step 1: Write the failing package-resolution test**

Add a minimal import smoke test file in `packages/domain-request/src/request-lifecycle.test.ts` that imports from `@nurseconnect/contracts` and asserts a known transition map shape exists.

- [ ] **Step 2: Run the package-level test command and verify it fails**

Run:

```bash
pnpm --filter @nurseconnect/domain-request test
```

Expected: FAIL because `@nurseconnect/domain-request` does not exist yet.

- [ ] **Step 3: Create the three package scaffolds**

Use the existing package style from `packages/contracts/package.json`, `packages/database/package.json`, and `packages/ui/package.json`.

Required package names:

```json
{
  "name": "@nurseconnect/platform-telemetry"
}
```

```json
{
  "name": "@nurseconnect/domain-request"
}
```

```json
{
  "name": "@nurseconnect/domain-identity"
}
```

Each package should include:

- `type-check` script
- `test` script
- `src/index.ts`
- TypeScript config extending the repo package base

Root script updates:

- add a root script for these new package tests, for example `test:architecture`
- update `test:ci` to include `test:architecture`

- [ ] **Step 4: Run the new package smoke test and workspace type-check**

Run:

```bash
pnpm --filter @nurseconnect/domain-request test
pnpm type-check
```

Expected: PASS for the package smoke test and successful workspace type-check.

- [ ] **Step 5: Commit**

```bash
git add package.json turbo.json packages/domain-request packages/domain-identity packages/platform-telemetry
git commit -m "chore: scaffold enterprise architecture packages"
```

### Task 2: Extract shared telemetry into `@nurseconnect/platform-telemetry`

**Files:**
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/platform-telemetry/src/admin-audit.ts`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/platform-telemetry/src/ops-logger.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/packages/platform-telemetry/src/index.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/admin/audit.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/telemetry/ops-logger.ts`
- Test: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/requests/request-events.db.test.ts`

- [ ] **Step 1: Write the failing import-shim test**

Before moving code, update one consumer import in a temporary local branch state so it imports from `@nurseconnect/platform-telemetry`, then run type-check to prove the package export is missing.

- [ ] **Step 2: Run type-check and verify the missing export failure**

Run:

```bash
pnpm type-check
```

Expected: FAIL with module/export resolution errors for `@nurseconnect/platform-telemetry`.

- [ ] **Step 3: Move telemetry code into the new package and leave app shims**

Move code from:

- `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/admin/audit.ts`
- `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/telemetry/ops-logger.ts`

into:

- `/Users/arbenlila/development/nurseconnect-v3/packages/platform-telemetry/src/admin-audit.ts`
- `/Users/arbenlila/development/nurseconnect-v3/packages/platform-telemetry/src/ops-logger.ts`

Then replace the old app files with thin re-exports, for example:

```ts
export * from "@nurseconnect/platform-telemetry";
```

or narrower exports if name collisions appear.

Do not change call sites yet unless required for build stability.

- [ ] **Step 4: Run focused verification**

Run:

```bash
pnpm type-check
pnpm --filter web exec vitest -c vitest.config.node.ts run src/server/requests/request-events.db.test.ts
```

Expected: PASS. No change in request-event DB behavior.

- [ ] **Step 5: Commit**

```bash
git add packages/platform-telemetry apps/web/src/server/admin/audit.ts apps/web/src/server/telemetry/ops-logger.ts
git commit -m "refactor: extract shared telemetry package"
```

### Task 3: Extract request lifecycle and write-side event primitive into `@nurseconnect/domain-request`

**Files:**
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-request/src/request-lifecycle.ts`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-request/src/request-events-write.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-request/src/index.ts`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-request/src/request-lifecycle.test.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/requests/request-lifecycle.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/requests/request-events.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/requests/request-lifecycle.test.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/requests/request-events.db.test.ts`

- [ ] **Step 1: Write the failing package unit test**

Add package-local tests that lock the current transitions:

```ts
import { canTransition } from "./request-lifecycle";

it("moves assigned -> accepted on accept", () => {
  expect(canTransition("assigned", "accept")).toBe("accepted");
});

it("throws on invalid open -> accept", () => {
  expect(() => canTransition("open", "accept")).toThrow("Invalid transition");
});
```

- [ ] **Step 2: Run the package test and verify it fails**

Run:

```bash
pnpm --filter @nurseconnect/domain-request test
```

Expected: FAIL until the lifecycle code is moved.

- [ ] **Step 3: Move the pure request-core pieces**

Move:

- the full `canTransition` logic from `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/requests/request-lifecycle.ts`
- only the write-side `appendRequestEvent` primitive from `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/requests/request-events.ts`

Keep in app file:

- `getRequestEventsForUser`
- `getNotificationsForActor`
- request-event read-side errors if still only used by app read models

Then turn the old `request-lifecycle.ts` into a thin re-export so existing imports keep working during the migration.

- [ ] **Step 4: Run focused verification**

Run:

```bash
pnpm --filter @nurseconnect/domain-request test
pnpm --filter web exec vitest -c vitest.config.node.ts run src/server/requests/request-lifecycle.test.ts src/server/requests/request-events.db.test.ts src/server/requests/request-actions.db.test.ts
```

Expected: PASS. No change in request action or request event write behavior.

- [ ] **Step 5: Commit**

```bash
git add packages/domain-request apps/web/src/server/requests/request-lifecycle.ts apps/web/src/server/requests/request-events.ts apps/web/src/server/requests/request-lifecycle.test.ts apps/web/src/server/requests/request-events.db.test.ts
git commit -m "refactor: extract request core package"
```

## Chunk 2: Domain Identity Extraction

### Task 4: Split `user-service.ts` into identity and interim nurse adapters

**Files:**
- Create: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/lib/nurse-record.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/lib/user-service.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/auth/portal-access.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/auth/user-service.db.test.ts`

- [ ] **Step 1: Write the failing DB-backed split test**

Add or update a test that imports the nurse helpers from the planned new interim file:

```ts
import { createNurseRecord, getNurseByUserId } from "@/lib/nurse-record";
```

Expected behavior stays identical to the current helper behavior.

- [ ] **Step 2: Run the DB test and verify it fails**

Run:

```bash
pnpm --filter web exec vitest -c vitest.config.node.ts run src/server/auth/user-service.db.test.ts
```

Expected: FAIL because `@/lib/nurse-record` does not exist yet.

- [ ] **Step 3: Split the file by responsibility**

Keep in `user-service.ts` only the identity/user-projection responsibilities:

- `ensureDomainUserFromSession`
- `upsertUser`
- `maybeBootstrapFirstAdmin`

Move into `nurse-record.ts`:

- `getNurseByUserId`
- `createNurseRecord`

If necessary, leave a temporary deprecated re-export in `user-service.ts` for nurse helpers only long enough to keep the tree green, then remove it before the end of Step 1.

- [ ] **Step 4: Run focused verification**

Run:

```bash
pnpm --filter web exec vitest -c vitest.config.node.ts run src/server/auth/user-service.db.test.ts src/server/auth/require-role.db.test.ts
pnpm type-check
```

Expected: PASS. Portal access still resolves nurse profile completeness correctly through the new app-local nurse adapter.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/user-service.ts apps/web/src/lib/nurse-record.ts apps/web/src/server/auth/portal-access.ts apps/web/src/server/auth/user-service.db.test.ts
git commit -m "refactor: split identity and nurse app services"
```

### Task 5: Create `@nurseconnect/domain-identity` pure policy and user-projection core

**Files:**
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-identity/src/errors.ts`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-identity/src/user-projection.ts`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-identity/src/session-user.ts`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-identity/src/require-role.ts`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-identity/src/portal-access-policy.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-identity/src/index.ts`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-identity/src/require-role.test.ts`
- Create: `/Users/arbenlila/development/nurseconnect-v3/packages/domain-identity/src/portal-access-policy.test.ts`

- [ ] **Step 1: Write failing unit tests for the pure policy**

Add package-local tests for:

- unauthorized vs forbidden role checks
- portal access decisions without redirect side effects
- admin/app portal mismatch decisions

Example:

```ts
import { requireAnyRole, ForbiddenError } from "./require-role";

it("throws when role is not allowed", async () => {
  await expect(
    requireAnyRole(["admin"], {
      session: { user: { id: "1", email: "a@test.local" } },
      user: { id: "u1", role: "patient", email: "a@test.local" },
    }),
  ).rejects.toBeInstanceOf(ForbiddenError);
});
```

- [ ] **Step 2: Run package tests and verify they fail**

Run:

```bash
pnpm --filter @nurseconnect/domain-identity test
```

Expected: FAIL until the package code exists.

- [ ] **Step 3: Implement domain-identity core without framework imports**

Rules:

- no `NextResponse`
- no `next/headers`
- no `redirect()` calls
- no `@/lib/canonical-routes` import

The package should export:

- typed errors (`UnauthorizedError`, `ForbiddenError`)
- pure role checks
- pure portal access decision logic
- session-user resolution that accepts a resolved session object and calls the moved identity projection functions

It is acceptable in this first move for `user-projection.ts` to import `@nurseconnect/database` directly.

- [ ] **Step 4: Run focused verification**

Run:

```bash
pnpm --filter @nurseconnect/domain-identity test
pnpm type-check
```

Expected: PASS. The package should compile without any `next/*` imports.

- [ ] **Step 5: Commit**

```bash
git add packages/domain-identity
git commit -m "feat: add domain identity package"
```

### Task 6: Convert `apps/web` auth files into adapters over `@nurseconnect/domain-identity`

**Files:**
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/auth/index.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/auth/session-user.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/auth/require-role.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/auth/portal-access.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/auth/require-auth.ts`
- Keep in place: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/auth/get-session.ts`
- Keep in place: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/auth/http.ts`
- Keep in place: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/lib/canonical-routes.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/auth/require-role.db.test.ts`
- Modify: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/auth/user-role.db.test.ts`

- [ ] **Step 1: Write the failing adapter-focused test**

Add or update a test that proves:

- `get-session.ts` still drives session retrieval
- `require-role.ts` now delegates policy to `@nurseconnect/domain-identity`
- `portal-access.ts` still redirects correctly using app-layer canonical routes

- [ ] **Step 2: Run the focused tests and verify the current tree fails**

Run:

```bash
pnpm --filter web exec vitest -c vitest.config.node.ts run src/server/auth/require-role.db.test.ts src/server/auth/user-role.db.test.ts
```

Expected: FAIL or type errors until the adapters are updated.

- [ ] **Step 3: Rewrite the auth files as adapters**

Implementation rules:

- `get-session.ts` remains the Better-Auth + `next/headers` adapter
- `http.ts` remains the `NextResponse` formatter and telemetry adapter
- `require-auth.ts` remains app-layer because it depends directly on `get-session.ts`
- `session-user.ts`, `require-role.ts`, and the pure decision portions of `portal-access.ts` delegate to `@nurseconnect/domain-identity`
- `portal-access.ts` continues to own `redirect()` and canonical route usage in app space

- [ ] **Step 4: Run full Step 0 + Step 1 verification**

Run:

```bash
pnpm type-check
pnpm --filter @nurseconnect/domain-request test
pnpm --filter @nurseconnect/domain-identity test
pnpm --filter web exec vitest -c vitest.config.node.ts run \
  src/server/auth/user-service.db.test.ts \
  src/server/auth/require-role.db.test.ts \
  src/server/auth/user-role.db.test.ts \
  src/server/requests/request-lifecycle.test.ts \
  src/server/requests/request-events.db.test.ts \
  src/server/requests/request-actions.db.test.ts
pnpm --filter web build
```

Expected: PASS. No change in current auth, request, or admin behavior.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/auth apps/web/src/lib/user-service.ts apps/web/src/lib/nurse-record.ts package.json turbo.json
git commit -m "refactor: adapt web auth to domain identity"
```

## Chunk 3: Final Verification and Handoff

### Task 7: Run regression verification and clean up transitional edges

**Files:**
- Review: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/admin/audit.ts`
- Review: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/telemetry/ops-logger.ts`
- Review: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/requests/request-lifecycle.ts`
- Review: `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/auth/index.ts`
- Review: `/Users/arbenlila/development/nurseconnect-v3/docs/superpowers/specs/2026-04-15-enterprise-package-architecture-design.md`

- [ ] **Step 1: Remove any temporary duplicate exports that are no longer needed**

Ensure the old app files are either:

- thin intentional adapters, or
- thin intentional re-export shims

They should not keep duplicate business logic.

- [ ] **Step 2: Run the release-relevant verification path**

Run:

```bash
pnpm type-check
pnpm test:ci
pnpm test:api
pnpm --filter web test:e2e:ui-smoke
```

Expected: PASS. If any command is too broad or flaky locally, document the narrower validated equivalent in the implementation notes before merging.

- [ ] **Step 3: Review import boundaries**

Verify:

- no new `next/*` imports inside `packages/domain-identity`
- no `NextResponse` inside any new domain package
- no business logic drift back into `apps/web/src/server/auth`
- no read-side request event logic accidentally moved into `domain-request`

- [ ] **Step 4: Update the implementation notes**

Add a short completion note to the execution PR or working notes covering:

- which app files are now adapters
- which package exports are authoritative
- any intentionally deferred cleanup for Step 2 or Step 3

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "test: verify architecture step 0 and 1 extraction"
```

## Plan Notes

- Keep DB-heavy tests in `apps/web` for now. Introducing package-level DB test infrastructure is out of scope for Step 0 and Step 1.
- `@nurseconnect/database` direct imports are allowed in this plan because the architecture spec explicitly permits them during early extraction.
- Do not try to extract dispatch in this plan. The `createAndAssignRequest()` transaction seam is intentionally left intact.
- Do not let `packages/domain-identity` import `next/server`, `next/navigation`, `next/headers`, or Better-Auth internals.
- If import churn gets noisy, prefer temporary app-layer adapter shims over a broad one-shot import rewrite.

## Review Gate

Subagent review is not authorized in this session. Before execution, do a manual review of this plan against:

- `/Users/arbenlila/development/nurseconnect-v3/docs/superpowers/specs/2026-04-15-enterprise-package-architecture-design.md`
- `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/auth/*`
- `/Users/arbenlila/development/nurseconnect-v3/apps/web/src/server/requests/*`

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-15-enterprise-package-architecture-step-0-1.md`. Ready to execute?
