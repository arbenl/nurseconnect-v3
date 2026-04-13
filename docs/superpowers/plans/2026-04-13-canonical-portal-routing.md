# Canonical Portal Routing Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize NurseConnect portal routing so auth flows, protected layouts, and edge guards all agree on the same role-based landing paths.

**Architecture:** Add a small canonical route helper and route all redirect decisions through it. Keep edge protection in a shared `proxy-logic` module, use server layouts to correct wrong-portal navigation, and use client auth flows only to select the canonical destination instead of embedding role-specific logic in multiple places.

**Tech Stack:** Next.js App Router, Better Auth, TypeScript, Vitest, Playwright

---

## Chunk 1: Canonical Route Core

### Task 1: Add the canonical route helper

**Files:**
- Create: `apps/web/src/lib/canonical-routes.ts`
- Test: `apps/web/src/lib/canonical-routes.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests that assert:
- `patient` resolves to `/dashboard`
- `nurse` resolves to `/dashboard`
- `admin` resolves to `/admin`
- unknown roles return `null`

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test src/lib/canonical-routes.test.ts`
Expected: FAIL because the helper does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement the role-to-route mapping plus a small helper for comparing a pathname with the canonical route.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test src/lib/canonical-routes.test.ts`
Expected: PASS

## Chunk 2: Edge Boundary Consolidation

### Task 2: Move middleware logic into a shared proxy module

**Files:**
- Create: `apps/web/src/lib/proxy-logic.ts`
- Modify: `apps/web/src/middleware.ts`

- [ ] **Step 1: Move the current middleware behavior behind a shared function**

Keep behavior equivalent for anonymous protected-route redirects and security headers.

- [ ] **Step 2: Keep middleware as a thin wrapper**

`middleware.ts` should only delegate to `proxy-logic.ts` and export the matcher.

- [ ] **Step 3: Run the relevant smoke guard**

Run: `pnpm --filter web test:e2e:ui-smoke`
Expected: anonymous `/dashboard` and `/admin` redirects still pass.

## Chunk 3: Canonical Redirect Wiring

### Task 3: Correct wrong-portal navigation in layouts

**Files:**
- Modify: `apps/web/src/app/(app)/layout.tsx`
- Modify: `apps/web/src/app/admin/layout.tsx`
- Reference: `apps/web/src/lib/auth/user.ts`
- Reference: `apps/web/src/server/auth/get-session.ts`

- [ ] **Step 1: Add the failing user-flow test**

Create a UI E2E test where an admin logs in and must land in `/admin`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm db:from-clean && pnpm --filter web exec playwright test tests/e2e-ui/auth.spec.ts --project=ui --grep "admin user lands in admin"`
Expected: FAIL because login still lands in `/dashboard`.

- [ ] **Step 3: Make `/dashboard` redirect admins to `/admin`**

Use the canonical route helper in the `(app)` layout.

- [ ] **Step 4: Make `/admin` redirect non-admin authenticated users to their canonical route**

Replace the current fallback to `/smoke/auth`.

- [ ] **Step 5: Re-run the targeted E2E test**

Run: `pnpm db:from-clean && pnpm --filter web exec playwright test tests/e2e-ui/auth.spec.ts --project=ui --grep "admin user lands in admin"`
Expected: PASS

### Task 4: Align login and onboarding redirects

**Files:**
- Modify: `apps/web/src/app/(auth)/login/page.tsx`
- Modify: `apps/web/src/app/(auth)/onboarding/page.tsx`
- Reference: `apps/web/src/hooks/use-user-profile.ts`

- [ ] **Step 1: Replace hardcoded `/dashboard` client redirects with canonical route resolution**

Use `/api/me` or the loaded user profile to compute the destination.

- [ ] **Step 2: Run focused UI coverage**

Run: `pnpm db:from-clean && pnpm --filter web exec playwright test tests/e2e-ui/auth.spec.ts tests/e2e-ui/onboarding.spec.ts --project=ui`
Expected: PASS

## Chunk 4: Verification

### Task 5: Run the regression set

**Files:**
- No file changes

- [ ] **Step 1: Run unit coverage for the new helper**

Run: `pnpm --filter web test src/lib/canonical-routes.test.ts`
Expected: PASS

- [ ] **Step 2: Run targeted API/UI checks**

Run: `pnpm gate:e2e-api`
Expected: PASS

Run: `pnpm --filter web test:e2e:ui-smoke`
Expected: PASS

- [ ] **Step 3: Run fast static gate**

Run: `pnpm gate:fast`
Expected: PASS

Plan complete and saved to `docs/superpowers/plans/2026-04-13-canonical-portal-routing.md`. Ready to execute.
