# Domain Admin Ops Extraction Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the admin active queue, triage severity policy, reassignment activity feed, and ops dashboard composition into `@nurseconnect/domain-admin-ops` without pulling in admin mutations, admin request-detail composition, or identity-owned role changes.

**Architecture:** Keep Step 5 as a read-model-only extraction. `@nurseconnect/domain-admin-ops` becomes the authoritative home for admin queue projection, triage scoring, reassignment activity feed composition, and dashboard aggregation. `apps/web` remains the delivery layer: it keeps HTTP/auth, page composition, UI filters, inline admin request-detail reads, admin audit writes, and all mutations. `triage-severity.ts` moves into the package and becomes a shared import for both package internals and the admin request-detail page.

**Tech Stack:** pnpm workspaces, Turborepo, TypeScript, Next.js App Router, Drizzle/Postgres, Vitest, Playwright, `@nurseconnect/database`, `@nurseconnect/contracts`, `@nurseconnect/domain-nurse`, and the new `@nurseconnect/domain-admin-ops`

---

## File Structure

### New package scaffold

- Create: `packages/domain-admin-ops/package.json`
- Create: `packages/domain-admin-ops/tsconfig.json`
- Create: `packages/domain-admin-ops/vitest.config.ts`
- Create: `packages/domain-admin-ops/src/index.ts`
- Create: `packages/domain-admin-ops/src/triage-severity.ts`
- Create: `packages/domain-admin-ops/src/triage-severity.test.ts`
- Create: `packages/domain-admin-ops/src/active-request-queue.ts`
- Create: `packages/domain-admin-ops/src/reassignment-activity-feed.ts`
- Create: `packages/domain-admin-ops/src/reassignment-activity-feed.test.ts`
- Create: `packages/domain-admin-ops/src/ops-dashboard.ts`
- Create: `packages/domain-admin-ops/src/ops-dashboard.test.ts`

### App routes and pages that cut over to the package

- Modify: `apps/web/src/app/api/admin/requests/active/route.ts`
- Modify: `apps/web/src/app/api/admin/activity/reassignments/route.ts`
- Modify: `apps/web/src/app/admin/page.tsx`
- Modify: `apps/web/src/app/admin/activity/page.tsx`
- Modify: `apps/web/src/app/admin/requests/page.tsx`
- Modify: `apps/web/src/app/admin/requests/[id]/page.tsx`

### Existing app-local server modules that get removed after cutover

- Delete: `apps/web/src/server/requests/triage-severity.ts`
- Delete: `apps/web/src/server/requests/admin-active-queue.ts`
- Delete: `apps/web/src/server/admin/activity-feed.ts`
- Delete: `apps/web/src/server/admin/ops-dashboard.ts`
- Delete: `apps/web/src/server/requests/admin-active-queue.test.ts`

### Verification and workspace wiring

- Modify: `apps/web/tests/e2e-api/admin-requests.api.e2e.ts`
- Modify: `apps/web/tests/e2e-api/admin-request-reassign.api.e2e.ts`
- Modify: `apps/web/tests/e2e-ui/dashboard-ux.spec.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

### Deliberate non-goals for this plan

- Do not move `apps/web/src/app/api/admin/users/[id]/role/route.ts`
- Do not move `apps/web/src/server/requests/admin-reassign.ts`
- Do not create `packages/domain-admin-ops/src/request-detail.ts`
- Do not move the assignable nurse-candidates query out of `apps/web/src/app/admin/requests/[id]/page.tsx`
- Do not move admin audit writes out of `apps/web`
- Do not redesign queue scoring or request-detail behavior

## Execution Strategy

- Start from a fresh dedicated worktree off merged `main`, not from the design branch.
- Keep the extraction read-model only: no writes, no identity mutations, no dispatch mutations.
- Move `triage-severity.ts` first, because both the queue projection and the admin request-detail page depend on it.
- Move `active-request-queue.ts` next and keep `AdminActiveRequestQueueResponseSchema.parse(...)` in the package to preserve output validation behavior.
- Move `reassignment-activity-feed.ts` into the package and keep its direct read dependency on `adminAuditLogs` through `@nurseconnect/database`.
- Move `ops-dashboard.ts` last inside the package so it composes over the already-extracted queue and feed modules plus `@nurseconnect/domain-nurse`.
- Cut all web consumers directly to `@nurseconnect/domain-admin-ops`; do not leave long-lived barrel re-export shims in `apps/web/src/server`.
- Add package-local tests for the pure logic and keep the existing API/UI tests as the behavior-preserving regression harness.

## Chunk 1: Scaffold `@nurseconnect/domain-admin-ops` and Move Queue Scoring + Projection

### Task 1: Create the package and move `triage-severity.ts` and `active-request-queue.ts`

**Files:**
- Create: `packages/domain-admin-ops/package.json`
- Create: `packages/domain-admin-ops/tsconfig.json`
- Create: `packages/domain-admin-ops/vitest.config.ts`
- Create: `packages/domain-admin-ops/src/index.ts`
- Create: `packages/domain-admin-ops/src/triage-severity.ts`
- Create: `packages/domain-admin-ops/src/triage-severity.test.ts`
- Create: `packages/domain-admin-ops/src/active-request-queue.ts`
- Modify: `apps/web/src/app/api/admin/requests/active/route.ts`
- Modify: `apps/web/src/app/admin/requests/page.tsx`
- Modify: `apps/web/src/app/admin/requests/[id]/page.tsx`
- Modify: `apps/web/tests/e2e-api/admin-requests.api.e2e.ts`
- Delete: `apps/web/src/server/requests/triage-severity.ts`
- Delete: `apps/web/src/server/requests/admin-active-queue.ts`
- Delete: `apps/web/src/server/requests/admin-active-queue.test.ts`

- [ ] **Step 1: Create the package scaffold and write the failing triage tests**

Create `packages/domain-admin-ops/package.json`:

```json
{
  "name": "@nurseconnect/domain-admin-ops",
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
    "@nurseconnect/domain-nurse": "workspace:*",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.19.11",
    "typescript": "^5.9.2",
    "vitest": "^3.2.4"
  }
}
```

Copy the existing `apps/web/src/server/requests/admin-active-queue.test.ts` cases into `packages/domain-admin-ops/src/triage-severity.test.ts`, updating imports to point at `./triage-severity`.

Keep the four current assertions:
- unassigned open requests outscore assigned requests with equal wait
- severity bands map from thresholds
- queue sorting is deterministic
- location hints are masked to coarse precision

- [ ] **Step 2: Install workspace dependencies**

Run:

```bash
pnpm install
```

Expected: `@nurseconnect/domain-admin-ops` resolves inside the workspace and `pnpm-lock.yaml` updates to include the new package.

- [ ] **Step 3: Run the red phase**

Run:

```bash
pnpm --filter @nurseconnect/domain-admin-ops test
pnpm --filter web exec playwright test tests/e2e-api/admin-requests.api.e2e.ts --project=api
```

Expected:
- the package test fails because `triage-severity.ts` and exports do not exist yet
- the API E2E still runs against the old `apps/web` implementation

- [ ] **Step 4: Implement `triage-severity.ts` and `active-request-queue.ts` in the package**

Move the current logic from:
- `apps/web/src/server/requests/triage-severity.ts`
- `apps/web/src/server/requests/admin-active-queue.ts`

Into:
- `packages/domain-admin-ops/src/triage-severity.ts`
- `packages/domain-admin-ops/src/active-request-queue.ts`

Keep the current behavior exactly:
- `ACTIVE_REQUEST_STATUSES`
- `DEFAULT_TRIAGE_SEVERITY_POLICY`
- `buildActiveQueueItem(...)`
- `sortQueueItems(...)`
- `toLocationHint(...)`
- the raw SQL queue query
- `AdminActiveRequestQueueResponseSchema.parse(...)`

Export these from `packages/domain-admin-ops/src/index.ts`:

```ts
export * from "./triage-severity";
export * from "./active-request-queue";
```

- [ ] **Step 5: Cut the first web consumers over and remove app-local queue modules**

Update imports:
- `apps/web/src/app/api/admin/requests/active/route.ts`
  - from `@/server/requests/admin-active-queue`
  - to `@nurseconnect/domain-admin-ops`
- `apps/web/src/app/admin/requests/page.tsx`
  - from `@/server/requests/admin-active-queue`
  - to `@nurseconnect/domain-admin-ops`
- `apps/web/src/app/admin/requests/[id]/page.tsx`
  - from `@/server/requests/triage-severity`
  - to `@nurseconnect/domain-admin-ops`

Then delete:
- `apps/web/src/server/requests/triage-severity.ts`
- `apps/web/src/server/requests/admin-active-queue.ts`
- `apps/web/src/server/requests/admin-active-queue.test.ts`

- [ ] **Step 6: Verify queue behavior still passes**

Run:

```bash
pnpm --filter @nurseconnect/domain-admin-ops test
pnpm type-check
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/admin-requests.api.e2e.ts --project=api
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-ui/dashboard-ux.spec.ts --project=ui --grep "active queue readable"
```

Expected:
- package triage tests pass
- admin requests API still returns the same sorted PHI-safe queue
- admin request-detail still renders location hints through the moved helper
- admin requests page remains readable in UI smoke

- [ ] **Step 7: Commit**

```bash
git add packages/domain-admin-ops apps/web/src/app/api/admin/requests/active/route.ts apps/web/src/app/admin/requests/page.tsx apps/web/src/app/admin/requests/[id]/page.tsx apps/web/tests/e2e-api/admin-requests.api.e2e.ts apps/web/tests/e2e-ui/dashboard-ux.spec.ts package.json pnpm-lock.yaml
git commit -m "feat: extract admin ops queue read models"
```

## Chunk 2: Extract Reassignment Activity Feed and Dashboard Aggregation

### Task 2: Move the merged activity feed and dashboard composition into the package

**Files:**
- Create: `packages/domain-admin-ops/src/reassignment-activity-feed.ts`
- Create: `packages/domain-admin-ops/src/reassignment-activity-feed.test.ts`
- Create: `packages/domain-admin-ops/src/ops-dashboard.ts`
- Create: `packages/domain-admin-ops/src/ops-dashboard.test.ts`
- Modify: `packages/domain-admin-ops/src/index.ts`
- Modify: `apps/web/src/app/api/admin/activity/reassignments/route.ts`
- Modify: `apps/web/src/app/admin/activity/page.tsx`
- Modify: `apps/web/src/app/admin/page.tsx`
- Modify: `apps/web/tests/e2e-api/admin-request-reassign.api.e2e.ts`
- Modify: `apps/web/tests/e2e-ui/dashboard-ux.spec.ts`
- Delete: `apps/web/src/server/admin/activity-feed.ts`
- Delete: `apps/web/src/server/admin/ops-dashboard.ts`

- [ ] **Step 1: Write the failing package tests for activity-feed helpers and dashboard aggregation**

Create `packages/domain-admin-ops/src/reassignment-activity-feed.test.ts` around pure helper exports such as:
- `toActivityMetadata(...)`
- `mergeAndSortActivityItems(...)`

Use representative fixtures to prove:
- invalid metadata values become `null`
- request-event and admin-audit items merge into one descending timeline
- equal timestamps break ties by numeric id in descending order

Create `packages/domain-admin-ops/src/ops-dashboard.test.ts` around a pure helper such as `summarizeOpsDashboard(...)` that accepts:
- queue items
- credential counts
- pending credential items
- recent activity items

Lock the current summary behavior:
- `requestCounts.total`
- `requestCounts.critical`
- `requestCounts.high`
- `requestCounts.unassigned`
- `requestCounts.assigned`
- `recentHotRequests` slices the top five queue items
- `recentActivity` passes through the feed items

- [ ] **Step 2: Run the red phase**

Run:

```bash
pnpm --filter @nurseconnect/domain-admin-ops test
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/admin-request-reassign.api.e2e.ts --project=api
```

Expected:
- package tests fail because the new modules and helper exports do not exist
- reassignment API E2E still passes against the old `apps/web` modules

- [ ] **Step 3: Implement `reassignment-activity-feed.ts` inside the package**

Move the current logic from `apps/web/src/server/admin/activity-feed.ts` into `packages/domain-admin-ops/src/reassignment-activity-feed.ts`.

Keep the current behavior exactly:
- query `requestEvents` for `request_reassigned`
- query `adminAuditLogs` for `request.reassigned`
- normalize metadata with UUID-or-null parsing
- merge and sort both sources
- validate the final payload with `AdminReassignmentActivityResponseSchema.parse(...)`

Make the helper functions explicit and testable:

```ts
export function toActivityMetadata(...)
export function mergeAndSortActivityItems(...)
export async function getAdminReassignmentActivityFeed(...)
```

- [ ] **Step 4: Implement `ops-dashboard.ts` inside the package**

Move the current logic from `apps/web/src/server/admin/ops-dashboard.ts` into `packages/domain-admin-ops/src/ops-dashboard.ts`.

Keep the live dependency on `@nurseconnect/domain-nurse`:
- `getNurseCredentialCounts()`
- `listNurseCredentials(...)`

Extract a small pure helper for summary counts so the package has real unit coverage:

```ts
export function summarizeOpsDashboard(input: {
  queueItems: ...
  credentialCounts: ...
  pendingCredentialItems: ...
  recentActivity: ...
}) { ... }
```

- [ ] **Step 5: Cut dashboard and activity consumers over**

Update imports:
- `apps/web/src/app/api/admin/activity/reassignments/route.ts`
  - from `@/server/admin/activity-feed`
  - to `@nurseconnect/domain-admin-ops`
- `apps/web/src/app/admin/activity/page.tsx`
  - from `@/server/admin/activity-feed`
  - to `@nurseconnect/domain-admin-ops`
- `apps/web/src/app/admin/page.tsx`
  - from `@/server/admin/ops-dashboard`
  - to `@nurseconnect/domain-admin-ops`

Then delete:
- `apps/web/src/server/admin/activity-feed.ts`
- `apps/web/src/server/admin/ops-dashboard.ts`

- [ ] **Step 6: Verify feed and dashboard behavior remain unchanged**

Run:

```bash
pnpm --filter @nurseconnect/domain-admin-ops test
pnpm type-check
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/admin-request-reassign.api.e2e.ts --project=api
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-ui/dashboard-ux.spec.ts --project=ui --grep "admin dashboard uses readable section cards"
```

Expected:
- package tests pass for metadata shaping and dashboard summary helpers
- the reassignment API E2E still proves the activity feed merges audit rows and request events
- the admin dashboard UI still renders the same operator cards

- [ ] **Step 7: Commit**

```bash
git add packages/domain-admin-ops apps/web/src/app/api/admin/activity/reassignments/route.ts apps/web/src/app/admin/activity/page.tsx apps/web/src/app/admin/page.tsx apps/web/tests/e2e-api/admin-request-reassign.api.e2e.ts apps/web/tests/e2e-ui/dashboard-ux.spec.ts
git commit -m "feat: extract admin ops dashboard and activity feed"
```

## Chunk 3: Finish Consumer Cutover and Register the Package in Architecture Tests

### Task 3: Wire the package into the workspace and run the full regression gate

**Files:**
- Modify: `package.json`
- Modify: `packages/domain-admin-ops/src/index.ts`
- Modify: `apps/web/src/app/admin/requests/[id]/page.tsx`
- Modify: `apps/web/tests/e2e-ui/dashboard-ux.spec.ts`

- [ ] **Step 1: Add `@nurseconnect/domain-admin-ops` to the architecture test chain**

Update the root `package.json` script `test:architecture` so it includes:

```bash
pnpm --filter @nurseconnect/domain-admin-ops test
```

Place it alongside the other domain-package tests, keeping the existing `@nurseconnect/contracts build` pre-step intact.

- [ ] **Step 2: Do the final import cleanup**

Confirm all remaining admin-ops consumers import from `@nurseconnect/domain-admin-ops` where appropriate:
- `apps/web/src/app/admin/requests/[id]/page.tsx` imports `toLocationHint(...)` from the package
- no imports remain from deleted files:
  - `@/server/requests/triage-severity`
  - `@/server/requests/admin-active-queue`
  - `@/server/admin/activity-feed`
  - `@/server/admin/ops-dashboard`

Run:

```bash
rg -n "@/server/(requests/triage-severity|requests/admin-active-queue|admin/activity-feed|admin/ops-dashboard)" apps/web/src
```

Expected: no matches.

- [ ] **Step 3: Run the full Step 5 verification suite**

Run:

```bash
pnpm --filter @nurseconnect/domain-admin-ops test
pnpm type-check
pnpm test:architecture
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/admin-requests.api.e2e.ts tests/e2e-api/admin-request-reassign.api.e2e.ts --project=api
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-ui/dashboard-ux.spec.ts --project=ui
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web build
```

Expected:
- new package tests pass
- architecture test includes the new package
- admin requests and reassignment API E2E remain green
- admin dashboard and queue UI smoke remain green
- web build passes with the extracted read-model package in place

- [ ] **Step 4: Commit**

```bash
git add package.json apps/web/src/app/admin/requests/[id]/page.tsx apps/web/tests/e2e-ui/dashboard-ux.spec.ts
git commit -m "chore: finish admin ops package cutover"
```

## Final Verification Checklist

- [ ] `@nurseconnect/domain-admin-ops` exists with queue, feed, and dashboard read models
- [ ] `triage-severity.ts` moved into the package and `apps/web` imports it from there
- [ ] admin queue route and page use the package directly
- [ ] admin activity route and page use the package directly
- [ ] admin dashboard page uses the package directly
- [ ] admin request-detail page still stays in `apps/web` and only imports `toLocationHint(...)` from the package
- [ ] user-role mutation remains in `apps/web`
- [ ] reassignment mutation remains in `apps/web`
- [ ] full API/UI/build verification passes

## Notes For The Implementer

- Do not create `request-detail.ts` in this slice.
- Do not move the assignable nurse-candidates query.
- Do not move `admin-reassign.ts`.
- Do not move `apps/web/src/app/api/admin/users/[id]/role/route.ts`.
- Prefer deleting the old app-local server read modules once all imports are cut over, rather than leaving stale shims behind.
