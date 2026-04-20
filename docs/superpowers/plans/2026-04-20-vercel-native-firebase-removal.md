# Vercel-Native Firebase Removal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Firebase from all active runtime, tooling, data-model, CI, and documentation surfaces while making the repo Vercel-native.

**Architecture:** `apps/web` becomes the sole runtime app, deployed by Vercel previews/production. Postgres, Drizzle, and Better Auth stay in place. Vercel-native observability and env management replace Firebase/manual assumptions.

**Tech Stack:** Next.js App Router, React 19, TypeScript, pnpm, Turborepo, Drizzle, Postgres, Better Auth, Vercel, Vitest, Playwright.

---

## Chunk 1: Remove Firebase Runtime And Tooling

### Task 1: Delete Firebase-only application and config

**Files:**
- Delete: `apps/functions/**`
- Delete: `firebase.json`
- Delete: `.firebaserc`
- Modify: `package.json`
- Modify: `pnpm-workspace.yaml`

- [ ] Remove the Firebase Functions workspace.
- [ ] Remove root scripts for `emulators:start` or Firebase deploy/log commands.
- [ ] Remove Firebase packages from workspace manifests.
- [ ] Run `pnpm install --lockfile-only` if manifest changes require lockfile updates.
- [ ] Run `pnpm -w type-check` and capture any expected failures.

### Task 2: Remove Firebase test bootstrap and emulator harness

**Files:**
- Modify/Delete: `vitest.setup.ts`
- Modify: `contributing.md`
- Modify: `Makefile`
- Modify: `apps/web/README.emu.md`

- [ ] Replace Firebase emulator setup with Postgres/Vercel-local guidance or remove the file if obsolete.
- [ ] Remove emulator commands from contributor docs.
- [ ] Remove Firebase CLI prerequisites.
- [ ] Run targeted tests that previously loaded the setup file.

## Chunk 2: Remove Firebase Compatibility Data Model

### Task 3: Remove `firebase_uid` schema and UI references

**Files:**
- Modify: `packages/database/src/schema/users.ts`
- Create: `packages/database/drizzle/<next>_remove_firebase_uid.sql`
- Modify: `apps/web/src/app/admin/users/user-table.tsx`
- Modify/Delete: `apps/web/src/app/admin/backfill/page.tsx`
- Modify/Delete: `scripts/backfill-users.ts`
- Modify/Delete: `scripts/export-firebase-users.ts`

- [ ] Remove `firebaseUid` from the users schema.
- [ ] Add a Drizzle migration dropping the unique index and column.
- [ ] Remove admin UI columns and pages dedicated to Firebase backfills.
- [ ] Delete Firebase import/export scripts.
- [ ] Run database package checks.

### Task 4: Update tests and fixtures

**Files:**
- Modify: `packages/domain-identity/src/*.test.ts`
- Modify: `apps/web/src/server/**/*.test.ts`

- [ ] Replace `firebaseUid: null` fixtures with the current user shape.
- [ ] Remove tests that exist only to validate Firebase compatibility.
- [ ] Run affected package tests.

## Chunk 3: Add Vercel-Native Runtime Support

### Task 5: Add Vercel observability

**Files:**
- Create: `apps/web/instrumentation.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] Add `@vercel/otel`, `@vercel/analytics`, and `@vercel/speed-insights` if not present.
- [ ] Register Vercel OTel in `instrumentation.ts`.
- [ ] Add Analytics and SpeedInsights components to the root layout.
- [ ] Run `pnpm --filter web type-check`.

### Task 6: Normalize Vercel route/middleware surface

**Files:**
- Modify: `apps/web/src/middleware.ts`
- Delete/Modify: `apps/web/middleware.ts`
- Modify: `apps/web/src/lib/proxy-logic.ts`

- [ ] Keep one authoritative middleware entrypoint.
- [ ] Remove legacy NextAuth middleware if Better Auth is the canonical auth implementation.
- [ ] Preserve security headers and rate-limiting behavior through the current proxy logic.
- [ ] Run middleware/proxy tests.

### Task 7: Add Vercel project configuration

**Files:**
- Create: `vercel.json`
- Modify: `turbo.json`
- Modify: `.env.example`
- Modify: `apps/web/.env.example`

- [ ] Add Vercel build/install/output settings appropriate for the monorepo.
- [ ] Add Vercel observability/env vars to Turbo global env if needed.
- [ ] Document required preview/production env vars without committing secrets.
- [ ] Run `pnpm --filter web build`.

## Chunk 4: Rewrite Active Documentation And CI

### Task 8: Make CI Vercel-native

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`

- [ ] Remove Firebase emulator references from CI commands.
- [ ] Keep GitHub Actions as a quality gate for type-check, lint, build, unit, DB, API, and Playwright checks.
- [ ] Document that preview deployment is handled by Vercel Git integration.

### Task 9: Rewrite active docs

**Files:**
- Modify: `README.md` if present
- Modify: `HANDOVER.md`
- Modify: `docs/runbooks/production_bootstrap_runbook.md`
- Modify: `docs/dev/troubleshooting.md`
- Move: obsolete Firebase docs to `docs/archive/`

- [ ] Replace Firebase CLI setup with Vercel CLI setup.
- [ ] Replace Firebase deploy/runbook language with Vercel preview and production deployment language.
- [ ] Archive historical migration notes that are useful but not active.

## Chunk 5: Verification

### Task 10: Full verification

- [ ] Run `rg -n "firebase|firebase-admin|firebase-functions|firestore|emulator" apps packages scripts .github docs`.
- [ ] Run `pnpm -w type-check`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm --filter web build`.
- [ ] Run targeted unit/API tests for auth, admin users, requests, and middleware.
- [ ] Run Playwright smoke using the repo-preferred Playwright MCP path when a dev server is available.
- [ ] Document any unrelated pre-existing failures with command output and exit code.
