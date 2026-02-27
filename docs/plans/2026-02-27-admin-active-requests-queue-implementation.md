# Admin Active Requests Queue Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a read-only admin triage queue for active service requests with deterministic severity scoring and PHI-safe fields.

**Architecture:** Keep write flows untouched. Add a new server-side read model that aggregates active request rows plus latest event timestamp, computes severity with a central policy object, and exposes it via an admin-only API route and admin page. Reuse existing auth/telemetry patterns and keep payload intentionally minimal to avoid PHI leakage.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle + SQL, Zod contracts, Vitest/Playwright tests.

---

### Task 1: Contracts + RED tests for scoring and queue behavior

**Files:**
- Modify: `packages/contracts/src/requests.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/web/src/server/requests/admin-active-queue.test.ts`

**Step 1: Write failing test for deterministic severity ordering and active-only filtering**
- Add test cases that assert:
  - active statuses (`open|assigned|accepted|enroute`) are included
  - terminal statuses are excluded
  - severity score ordering is deterministic for equal/near values
  - severity band mapping (`critical/high/medium/low`) is stable.

**Step 2: Run targeted test to confirm RED**
- Run: `pnpm --filter web test -- src/server/requests/admin-active-queue.test.ts`
- Expected: fail due missing module/functions.

### Task 2: Implement read model and policy

**Files:**
- Create: `apps/web/src/server/requests/triage-severity.ts`
- Create: `apps/web/src/server/requests/admin-active-queue.ts`

**Step 1: Implement minimal policy config + pure scoring helpers**
- Add central policy object with weights/thresholds.
- Add pure function to compute `severityScore`, `severityBand`, and wait/staleness derivations.

**Step 2: Implement DB-backed active queue query**
- Add read model function that:
  - fetches active request rows + latest event timestamp
  - computes PHI-safe DTO (`locationHint` only, no address/patient identifiers)
  - sorts deterministically by `severityScore desc`, `waitMinutes desc`, `createdAt asc`, `requestId asc`.

**Step 3: Re-run targeted tests for GREEN**
- Run: `pnpm --filter web test -- src/server/requests/admin-active-queue.test.ts`
- Expected: pass.

### Task 3: Add admin API endpoint + API RED/GREEN test

**Files:**
- Create: `apps/web/src/app/api/admin/requests/active/route.ts`
- Create: `apps/web/tests/e2e-api/admin-requests.api.e2e.ts`
- Modify: `apps/web/tests/e2e-utils/db.ts` (only if helper needed)

**Step 1: Write failing API e2e tests first**
- Cases:
  - unauthenticated => `401`
  - non-admin => `403`
  - admin => `200` with PHI-safe queue payload and deterministic order.

**Step 2: Run file-level e2e test to confirm RED**
- Run: `pnpm --filter web test:e2e:api -- tests/e2e-api/admin-requests.api.e2e.ts`
- Expected: fail before route exists.

**Step 3: Implement route using existing auth + telemetry style**
- Require admin role.
- Return queue response with request-id header.
- Normalize auth and error handling to current patterns.

**Step 4: Re-run e2e test for GREEN**
- Run: `pnpm --filter web test:e2e:api -- tests/e2e-api/admin-requests.api.e2e.ts`

### Task 4: Admin UI read-only queue page

**Files:**
- Create: `apps/web/src/app/admin/requests/page.tsx`
- Modify: `apps/web/src/app/admin/layout.tsx`
- Modify: `apps/web/src/app/admin/page.tsx`

**Step 1: Add read-only queue page bound to server read model**
- Render table/cards for active queue items.
- No write controls in MVP.

**Step 2: Link from admin nav and dashboard quick actions**
- Add route link in admin layout nav.
- Add dashboard link card entry.

**Step 3: Quick rendering smoke test**
- Run: `pnpm --filter web test -- src/server/requests/admin-active-queue.test.ts`
- Run: `pnpm --filter web type-check`

### Task 5: Multi-agent verification and evidence

**Files:**
- No code file required; produce run artifacts under `tmp/multi-agent/...`

**Step 1: Run targeted verification suite**
- `pnpm --filter web test -- src/server/requests/admin-active-queue.test.ts`
- `pnpm --filter web test:e2e:api -- tests/e2e-api/admin-requests.api.e2e.ts`
- `pnpm --filter web type-check`

**Step 2: Run multi-agent orchestrated verification pass**
- `pnpm multiagent:run -- --task admin-active-queue --mode auto --complexity 6 --estimated-cost-usd 4 --budget-usd 20 --independent-task-count 2 --requires-compliance-review true`

**Step 3: Capture outputs**
- Record key command output and artifact paths (`events.ndjson`, `role-scorecard.json`, step logs).
