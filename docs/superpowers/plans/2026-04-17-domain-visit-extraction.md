# Domain Visit Extraction Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the live visit experience read side into `@nurseconnect/domain-visit` without reopening request writes, dispatch writes, or changing the existing patient and nurse dashboard payloads.

**Architecture:** Keep Step 7 as a read-model-only extraction. `@nurseconnect/domain-visit` becomes the authoritative home for actor-safe patient/nurse visit projections, visit timeline reads, visit notifications, and shared visit-state helpers. `apps/web` remains the adapter layer: it keeps auth, HTTP parsing/formatting, polling cadence, legacy response adaptation, and any future read-audit instrumentation.

**Tech Stack:** pnpm workspaces, Turborepo, TypeScript, Next.js App Router, Drizzle/Postgres, Vitest, Playwright, `@nurseconnect/database`, `@nurseconnect/contracts`, `@nurseconnect/domain-request`, and the new `@nurseconnect/domain-visit`

---

## File Structure

### New package scaffold

- Create: `packages/domain-visit/package.json`
- Create: `packages/domain-visit/tsconfig.json`
- Create: `packages/domain-visit/vitest.config.ts`
- Create: `packages/domain-visit/vitest.db.config.ts`
- Create: `packages/domain-visit/src/index.ts`
- Create: `packages/domain-visit/src/errors.ts`
- Create: `packages/domain-visit/src/visit-state.ts`
- Create: `packages/domain-visit/src/visit-state.test.ts`
- Create: `packages/domain-visit/src/patient-visit-projections.ts`
- Create: `packages/domain-visit/src/patient-visit-projections.db.test.ts`
- Create: `packages/domain-visit/src/nurse-visit-projections.ts`
- Create: `packages/domain-visit/src/nurse-visit-projections.db.test.ts`
- Create: `packages/domain-visit/src/visit-timeline.ts`
- Create: `packages/domain-visit/src/visit-timeline.db.test.ts`
- Create: `packages/domain-visit/src/visit-notifications.ts`
- Create: `packages/domain-visit/src/visit-notifications.db.test.ts`

### Contract additions for public route-safe shapes

- Create: `packages/contracts/src/visits.ts`
- Modify: `packages/contracts/src/index.ts`

### App routes and consumers that cut over to the package

- Modify: `apps/web/src/app/api/requests/mine/route.ts`
- Modify: `apps/web/src/app/api/requests/assigned/route.ts`
- Modify: `apps/web/src/app/api/requests/[id]/events/route.ts`
- Modify: `apps/web/src/app/api/me/notifications/route.ts`
- Modify: `apps/web/src/app/admin/requests/[id]/page.tsx`
- Modify: `apps/web/src/server/requests/allocate-request.ts`
- Modify: `apps/web/src/hooks/use-nurse-assignment-feed.ts`
- Modify: `apps/web/src/components/dashboard/patient-request-card.tsx`
- Modify: `apps/web/src/components/dashboard/patient-request-status-card.tsx`
- Modify: `apps/web/src/components/dashboard/patient-request-history-card.tsx`
- Modify: `apps/web/src/components/dashboard/nurse-assignment-card.tsx`

### Existing app-local request read modules that get removed or slimmed down

- Delete: `apps/web/src/server/requests/request-events.ts`
- Modify: `apps/web/src/server/requests/request-events.db.test.ts`

### Regression coverage and workspace wiring

- Create: `apps/web/tests/e2e-api/me-notifications.api.e2e.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

### Deliberate non-goals for this plan

- Do not move `apps/web/src/server/requests/request-actions.ts`
- Do not move `apps/web/src/server/requests/allocate-request.ts` write-side policy into the package
- Do not move `apps/web/src/server/requests/admin-reassign.ts`
- Do not redesign `apps/web/src/app/admin/requests/[id]/page.tsx`
- Do not add `304` or ETag behavior
- Do not introduce unread notification mutation state
- Do not create a new `visits` table

## Execution Strategy

- Start from a fresh dedicated worktree off merged `main`, not from the design branch.
- Scaffold `@nurseconnect/domain-visit` with split unit and DB test configs from the start:
  - `test` stays unit-only so `pnpm test:architecture` remains environment-agnostic
  - `test:db` runs the DB-backed projection tests explicitly
- Add contract-safe visit projection schemas in `@nurseconnect/contracts` for the patient and nurse dashboard payloads.
- Extract patient and nurse projections first, because they are the highest-volume route and UI consumers.
- Keep `/api/requests/mine` behavior-preserving by treating it as a legacy adapter:
  - patient callers use the patient projection
  - nurse callers use the nurse projection
  - the route recombines active + history in memory before returning the legacy array payload
- Keep `/api/requests/assigned` behavior-preserving while backing it with separate active/history queries inside the package.
- Extract timeline and notifications second by moving the read-side logic out of `apps/web/src/server/requests/request-events.ts`.
- Keep cursor pagination first-class inside the package APIs and DB tests, but do not force the current HTTP routes to expose cursors yet; current routes should continue calling the first page with existing limits/defaults.
- Delete `apps/web/src/server/requests/request-events.ts` only after:
  - `allocate-request.ts` imports `appendRequestEvent` directly from `@nurseconnect/domain-request`
  - routes and the admin request-detail page import read functions from `@nurseconnect/domain-visit`
- Add focused API coverage for `/api/me/notifications`, because that route currently has no route-level regression test.

## Chunk 1: Scaffold `@nurseconnect/domain-visit` and Extract Patient/Nurse Projections

### Task 1: Create the package, add public visit projection contracts, and move patient/nurse projection reads

**Files:**
- Create: `packages/domain-visit/package.json`
- Create: `packages/domain-visit/tsconfig.json`
- Create: `packages/domain-visit/vitest.config.ts`
- Create: `packages/domain-visit/vitest.db.config.ts`
- Create: `packages/domain-visit/src/index.ts`
- Create: `packages/domain-visit/src/errors.ts`
- Create: `packages/domain-visit/src/visit-state.ts`
- Create: `packages/domain-visit/src/visit-state.test.ts`
- Create: `packages/domain-visit/src/patient-visit-projections.ts`
- Create: `packages/domain-visit/src/patient-visit-projections.db.test.ts`
- Create: `packages/domain-visit/src/nurse-visit-projections.ts`
- Create: `packages/domain-visit/src/nurse-visit-projections.db.test.ts`
- Create: `packages/contracts/src/visits.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/web/src/app/api/requests/mine/route.ts`
- Modify: `apps/web/src/app/api/requests/assigned/route.ts`
- Modify: `apps/web/src/hooks/use-nurse-assignment-feed.ts`
- Modify: `apps/web/src/components/dashboard/patient-request-card.tsx`
- Modify: `apps/web/src/components/dashboard/patient-request-status-card.tsx`
- Modify: `apps/web/src/components/dashboard/patient-request-history-card.tsx`
- Modify: `apps/web/src/components/dashboard/nurse-assignment-card.tsx`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Create the package scaffold, contract schemas, and failing tests**

Create `packages/domain-visit/package.json`:

```json
{
  "name": "@nurseconnect/domain-visit",
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
    "test": "vitest run --config vitest.config.ts",
    "test:db": "vitest run --config vitest.db.config.ts"
  },
  "dependencies": {
    "@nurseconnect/contracts": "workspace:*",
    "@nurseconnect/database": "workspace:*",
    "drizzle-orm": "^0.40.0"
  },
  "devDependencies": {
    "@types/node": "^20.19.11",
    "typescript": "^5.9.2",
    "vitest": "^3.2.4"
  }
}
```

Create `packages/contracts/src/visits.ts` with public route-safe schemas such as:

```ts
import { z } from "zod";

import { RequestStatusInfo } from "./requests";

export const PatientVisitSummarySchema = z.object({
  id: z.string().uuid(),
  status: RequestStatusInfo,
  address: z.string(),
  assignedNurseUserId: z.string().uuid().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  requestType: z.enum(["scheduled", "same_day"]),
  scheduledFor: z.string().datetime({ offset: true }).nullable(),
  careType: z.string().nullable(),
});

export const GetPatientVisitsResponseSchema = z.array(PatientVisitSummarySchema);

export const NurseVisitSummarySchema = z.object({
  id: z.string().uuid(),
  address: z.string(),
  status: RequestStatusInfo,
  createdAt: z.string().datetime({ offset: true }),
  requestType: z.enum(["scheduled", "same_day"]),
  scheduledFor: z.string().datetime({ offset: true }).nullable(),
  careType: z.string().nullable(),
});

export const NurseVisitFeedResponseSchema = z.object({
  activeAssignment: NurseVisitSummarySchema.nullable(),
  recentAssignments: z.array(NurseVisitSummarySchema),
});
```

Update `packages/contracts/src/index.ts` to export the new visit schemas explicitly:

```ts
export * from "./visits";
```

Create `packages/domain-visit/src/visit-state.test.ts` with cases like:

```ts
import { describe, expect, it } from "vitest";

import { isVisitActive, isVisitHistorical, isVisitTerminal } from "./visit-state";

describe("visit-state", () => {
  it("treats assigned, accepted, and enroute as active", () => {
    expect(isVisitActive("assigned")).toBe(true);
    expect(isVisitActive("accepted")).toBe(true);
    expect(isVisitActive("enroute")).toBe(true);
    expect(isVisitActive("completed")).toBe(false);
  });

  it("treats completed, canceled, and rejected as terminal/historical", () => {
    expect(isVisitTerminal("completed")).toBe(true);
    expect(isVisitTerminal("canceled")).toBe(true);
    expect(isVisitHistorical("rejected")).toBe(true);
    expect(isVisitHistorical("open")).toBe(false);
  });
});
```

Create `packages/domain-visit/src/patient-visit-projections.db.test.ts` with DB-backed assertions like:
- the active visit comes back separately from history
- history is ordered newest-first
- the history cursor returns older items only
- the returned items satisfy `GetPatientVisitsResponseSchema`

Create `packages/domain-visit/src/nurse-visit-projections.db.test.ts` with DB-backed assertions like:
- only assigned nurse work appears in the nurse projection
- a request where the nurse is the patient does not leak into the nurse assignment feed
- active assignment uses `isVisitActive(...)`
- recent assignments are shallow and limited

- [ ] **Step 2: Install workspace dependencies**

Run:

```bash
pnpm install
```

Expected:
- the new workspace package resolves
- `pnpm-lock.yaml` updates

- [ ] **Step 3: Run the red phase**

Run:

```bash
pnpm --filter @nurseconnect/domain-visit test
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter @nurseconnect/domain-visit run test:db
```

Expected:
- unit tests fail because `visit-state.ts` does not exist
- DB tests fail because the projection modules do not exist

- [ ] **Step 4: Implement `visit-state.ts`, patient/nurse projections, and the strict facade**

Implement `packages/domain-visit/src/visit-state.ts` using `RequestStatus` from `@nurseconnect/contracts`:

```ts
import type { RequestStatus } from "@nurseconnect/contracts";

const ACTIVE_VISIT_STATUSES: ReadonlySet<RequestStatus> = new Set(["assigned", "accepted", "enroute"]);
const TERMINAL_VISIT_STATUSES: ReadonlySet<RequestStatus> = new Set(["completed", "canceled", "rejected"]);

export function isVisitActive(status: RequestStatus) {
  return ACTIVE_VISIT_STATUSES.has(status);
}

export function isVisitTerminal(status: RequestStatus) {
  return TERMINAL_VISIT_STATUSES.has(status);
}

export function isVisitHistorical(status: RequestStatus) {
  return isVisitTerminal(status);
}
```

Implement `packages/domain-visit/src/patient-visit-projections.ts` with:
- `DbClient` injection
- separate active and history reads
- file-local mappers:
  - `mapToPatientVisitSummary(...)`
- a public function such as:

```ts
export async function getPatientVisitProjection(
  db: DbClient,
  input: {
    actorUserId: string;
    historyLimit?: number | null;
    historyCursor?: { createdAt: string; id: string } | null;
  }
) {
  return {
    activeVisit,
    recentVisits,
    nextHistoryCursor,
  };
}
```

Implement `packages/domain-visit/src/nurse-visit-projections.ts` with:
- `DbClient` injection
- separate active and history reads
- file-local mappers:
  - `mapToNurseVisitSummary(...)`
- a public function such as:

```ts
export async function getNurseVisitProjection(
  db: DbClient,
  input: {
    actorUserId: string;
    historyLimit?: number | null;
    historyCursor?: { createdAt: string; id: string } | null;
  }
) {
  return {
    activeAssignment,
    recentAssignments,
    nextHistoryCursor,
  };
}
```

Make `packages/domain-visit/src/index.ts` a strict facade:

```ts
export {
  isVisitActive,
  isVisitHistorical,
  isVisitTerminal,
} from "./visit-state";
export {
  getPatientVisitProjection,
} from "./patient-visit-projections";
export {
  getNurseVisitProjection,
} from "./nurse-visit-projections";
export {
  VisitForbiddenError,
  VisitNotFoundError,
} from "./errors";
```

Do not use `export *`.

- [ ] **Step 5: Cut the first app adapters and consumer types over**

Update `apps/web/src/app/api/requests/mine/route.ts` so it stays behavior-preserving:
- keep `requireAnyRole(...)`
- when `user.role === "nurse"`, call `getNurseVisitProjection(db, ...)`
- otherwise call `getPatientVisitProjection(db, ...)`
- for the legacy array payload, recombine the result in memory:

```ts
const requests = user.role === "nurse"
  ? [projection.activeAssignment, ...projection.recentAssignments].filter(
      (
        assignment,
      ): assignment is NonNullable<typeof assignment> => assignment !== null,
    )
  : [projection.activeVisit, ...projection.recentVisits].filter(
      (visit): visit is NonNullable<typeof visit> => visit !== null,
    );
return NextResponse.json(requests);
```

Update `apps/web/src/app/api/requests/assigned/route.ts` to call `getNurseVisitProjection(db, ...)` and return:

```ts
{
  activeAssignment: projection.activeAssignment,
  recentAssignments: projection.recentAssignments,
}
```

Update the dashboard consumer types to import the new contract types instead of duplicating them locally:
- `apps/web/src/hooks/use-nurse-assignment-feed.ts`
- `apps/web/src/components/dashboard/patient-request-status-card.tsx`
- `apps/web/src/components/dashboard/patient-request-history-card.tsx`
- `apps/web/src/components/dashboard/patient-request-card.tsx`
- `apps/web/src/components/dashboard/nurse-assignment-card.tsx`

While cutting the nurse dashboard consumers over, verify that the new `NurseVisitSummarySchema` still includes every field the existing UI actually reads. If Playwright or TypeScript surfaces a missing field during this step, extend the contract with that specific field instead of broadening it back to the raw row shape.

Update the root `package.json` `test:architecture` script to include:

```bash
pnpm --filter @nurseconnect/domain-visit test
```

- [ ] **Step 6: Verify patient/nurse projection behavior**

Run:

```bash
pnpm --filter @nurseconnect/domain-visit test
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter @nurseconnect/domain-visit run test:db
pnpm type-check
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/requests.api.e2e.ts --project=api
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-ui/requests.spec.ts tests/e2e-ui/nurse.spec.ts --project=ui
```

Expected:
- package unit and DB tests pass
- `/api/requests/mine` still returns the legacy array shape expected by the patient dashboard
- `/api/requests/assigned` still returns the active/recent feed expected by the nurse dashboard
- patient and nurse UI flows remain unchanged

- [ ] **Step 7: Commit**

```bash
git add packages/contracts packages/domain-visit apps/web/src/app/api/requests/mine/route.ts apps/web/src/app/api/requests/assigned/route.ts apps/web/src/hooks/use-nurse-assignment-feed.ts apps/web/src/components/dashboard/patient-request-card.tsx apps/web/src/components/dashboard/patient-request-status-card.tsx apps/web/src/components/dashboard/patient-request-history-card.tsx apps/web/src/components/dashboard/nurse-assignment-card.tsx package.json pnpm-lock.yaml
git commit -m "feat: extract visit projections"
```

## Chunk 2: Extract Timeline and Notifications, Then Remove the App-Local Read Module

### Task 2: Move actor-scoped timeline and notification reads into `@nurseconnect/domain-visit`

**Files:**
- Create: `packages/domain-visit/src/visit-timeline.ts`
- Create: `packages/domain-visit/src/visit-timeline.db.test.ts`
- Create: `packages/domain-visit/src/visit-notifications.ts`
- Create: `packages/domain-visit/src/visit-notifications.db.test.ts`
- Modify: `packages/domain-visit/src/errors.ts`
- Modify: `packages/domain-visit/src/index.ts`
- Modify: `apps/web/src/app/api/requests/[id]/events/route.ts`
- Modify: `apps/web/src/app/api/me/notifications/route.ts`
- Modify: `apps/web/src/app/admin/requests/[id]/page.tsx`
- Modify: `apps/web/src/server/requests/allocate-request.ts`
- Modify: `apps/web/src/server/requests/request-events.db.test.ts`
- Create: `apps/web/tests/e2e-api/me-notifications.api.e2e.ts`
- Delete: `apps/web/src/server/requests/request-events.ts`

- [ ] **Step 1: Move the failing read-side DB assertions into package-local tests and add route coverage**

Create `packages/domain-visit/src/visit-timeline.db.test.ts` by moving the read-side timeline assertions out of `apps/web/src/server/requests/request-events.db.test.ts`.

Keep cases like:
- ordered timeline returns `request_created`, `request_assigned`, `request_accepted`
- outsider access throws `VisitForbiddenError`
- missing request throws `VisitNotFoundError`

Create `packages/domain-visit/src/visit-notifications.db.test.ts` by moving the existing read-side notification assertions out of `apps/web/src/server/requests/request-events.db.test.ts`.

Keep and extend cases like:
- patient only sees notifications for their requests
- nurse only sees notifications for assigned work
- admins can read all notifications
- `sinceIso` and `limit` still work
- cursor returns older items only

Create `apps/web/tests/e2e-api/me-notifications.api.e2e.ts` with route-level coverage such as:

```ts
test("current actor sees only their notification-visible events", async ({ request }) => {
  // seed patient + nurse + two requests
  // login one actor
  // GET /api/me/notifications
  // assert only that actor's request ids appear
});

test("invalid limit returns 400", async ({ request }) => {
  // login actor
  // GET /api/me/notifications?limit=abc
  // expect 400
});
```

- [ ] **Step 2: Run the red phase**

Run:

```bash
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter @nurseconnect/domain-visit exec vitest run --config vitest.db.config.ts src/visit-timeline.db.test.ts src/visit-notifications.db.test.ts
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/me-notifications.api.e2e.ts --project=api
```

Expected:
- DB tests fail because the new read modules and errors do not exist
- the route test fails because `/api/me/notifications` still depends on app-local request-events

- [ ] **Step 3: Implement `visit-timeline.ts`, `visit-notifications.ts`, and visit read errors**

Add to `packages/domain-visit/src/errors.ts`:

```ts
export class VisitNotFoundError extends Error {
  constructor(message = "Request not found") {
    super(message);
    this.name = "VisitNotFoundError";
  }
}

export class VisitForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "VisitForbiddenError";
  }
}
```

Implement `packages/domain-visit/src/visit-timeline.ts` with a public function such as:

```ts
export async function getVisitTimelineForActor(
  db: DbClient,
  input: {
    requestId: string;
    actorUserId: string;
    actorRole: "admin" | "nurse" | "patient";
  }
) {
  // load request ownership
  // enforce actor visibility
  // query request events in ascending order
  // map and parse with GetRequestEventsResponseSchema
}
```

Implement `packages/domain-visit/src/visit-notifications.ts` with a public function such as:

```ts
export async function getVisitNotificationsForActor(
  db: DbClient,
  input: {
    actorUserId: string;
    actorRole: "admin" | "nurse" | "patient";
    sinceIso?: string | null;
    limit?: number | null;
    cursor?: { createdAt: string; id: number } | null;
  }
) {
  // actor visibility
  // stable order by createdAt desc, id desc
  // optional since filter
  // optional cursor filter
  // parse with GetRequestEventsResponseSchema
}
```

Keep the cursor internal to the package API for now; do not require the HTTP route to expose it in this slice.

- [ ] **Step 4: Cut route and page consumers over, then delete the app-local read module**

Update `apps/web/src/app/api/requests/[id]/events/route.ts` to import:
- `getVisitTimelineForActor`
- `VisitForbiddenError`
- `VisitNotFoundError`

From `@nurseconnect/domain-visit`.

Update `apps/web/src/app/api/me/notifications/route.ts` to import `getVisitNotificationsForActor` from `@nurseconnect/domain-visit` and pass the existing `since`/`limit` query parameters through.

Update `apps/web/src/app/admin/requests/[id]/page.tsx` to import `getVisitTimelineForActor` and `VisitNotFoundError` from `@nurseconnect/domain-visit`.

Update `apps/web/src/server/requests/allocate-request.ts` to import `appendRequestEvent` directly from `@nurseconnect/domain-request`.

Trim `apps/web/src/server/requests/request-events.db.test.ts` so it keeps only the write-side event assertions that still belong with request/dispatch orchestration, and remove the read-side cases that moved into the package DB tests.

Then delete:
- `apps/web/src/server/requests/request-events.ts`

- [ ] **Step 5: Verify timeline and notification behavior**

Run:

```bash
pnpm --filter @nurseconnect/domain-visit test
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter @nurseconnect/domain-visit run test:db
pnpm type-check
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/requests.api.e2e.ts tests/e2e-api/admin-request-reassign.api.e2e.ts tests/e2e-api/me-notifications.api.e2e.ts --project=api
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-ui/requests.spec.ts tests/e2e-ui/nurse.spec.ts --project=ui
```

Expected:
- package unit and DB tests pass
- `/api/requests/[id]/events` still returns the ordered timeline
- `/api/me/notifications` still enforces actor-specific visibility and input validation
- the admin request-detail page still renders timeline rows
- patient and nurse UI flows remain unchanged

- [ ] **Step 6: Commit**

```bash
git add packages/domain-visit apps/web/src/app/api/requests/[id]/events/route.ts apps/web/src/app/api/me/notifications/route.ts apps/web/src/app/admin/requests/[id]/page.tsx apps/web/src/server/requests/allocate-request.ts apps/web/src/server/requests/request-events.db.test.ts apps/web/tests/e2e-api/me-notifications.api.e2e.ts
git rm apps/web/src/server/requests/request-events.ts
git commit -m "feat: extract visit timeline and notifications"
```

## Final Verification

- [ ] **Step 1: Run the full slice verification**

Run:

```bash
pnpm --filter @nurseconnect/domain-visit test
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter @nurseconnect/domain-visit run test:db
pnpm type-check
pnpm test:architecture
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/requests.api.e2e.ts tests/e2e-api/admin-request-reassign.api.e2e.ts tests/e2e-api/me-notifications.api.e2e.ts --project=api
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-ui/requests.spec.ts tests/e2e-ui/nurse.spec.ts tests/e2e-ui/dashboard-ux.spec.ts --project=ui
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web build
```

Expected:
- `@nurseconnect/domain-visit` unit and DB tests pass
- root `test:architecture` includes the new package and stays green
- patient request, nurse assignment, timeline, reassignment timeline, and notifications regressions stay green
- `apps/web` build succeeds with the new package boundary

- [ ] **Step 2: Prepare publish flow**

Run:

```bash
git status
git log --oneline --decorate -5
```

Expected:
- working tree is clean
- the commits map cleanly to the two chunks above

Plan complete and saved to `docs/superpowers/plans/2026-04-17-domain-visit-extraction.md`. Ready to execute?
