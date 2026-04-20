# Vercel-Native Firebase Removal Design

## Goal

Make NurseConnect a Vercel-native Next.js application with no active Firebase compatibility surface. The migration keeps the existing `Postgres + Drizzle + Better Auth` backend model and removes Firebase runtime code, emulator tooling, deployment assumptions, compatibility schema fields, and documentation from the active repo.

## Decisions

- Vercel is the only deployment and preview platform for the web app.
- `apps/web` is the only runtime application in this repository.
- `apps/functions` is removed unless a real Firebase function contains product logic that must be moved into a Next.js route handler first.
- `Postgres + Drizzle + Better Auth` remain the app backend/auth foundation.
- Firebase compatibility is recovered through git history, not kept as dormant active code.
- One-time historical migration notes may live in `docs/archive/`, but they must not describe active setup steps.

## Target Architecture

### Runtime

The Next.js App Router app in `apps/web` owns user-facing pages, API routes, auth callbacks, admin workflows, and backend-for-frontend logic. Server code uses Vercel-compatible route handlers and server modules, not Firebase Functions.

### Deployment

Vercel Git integration creates preview deployments for branches and production deployments from the production branch. GitHub Actions remains a quality gate for type-checking, linting, builds, and tests, but no longer references Firebase emulators or Firebase deploy commands.

### Environment

Local and deployed environments use Vercel environment variable workflows. Local bootstrap documents `vercel link` and `vercel env pull .env.local`. Runtime configuration continues to use existing server-only env vars such as `DATABASE_URL`, `BETTER_AUTH_SECRET`, `APP_URL`, and `BETTER_AUTH_URL`.

### Observability

The app uses Vercel-native observability:

- `instrumentation.ts` registers Vercel OpenTelemetry.
- Route handlers and server actions log structured JSON to Vercel runtime logs.
- Vercel Web Analytics and Speed Insights are installed in the app shell if compatible with the current Next.js version.

### Data Model

Firebase-only identity compatibility fields are removed from active schema and UI after confirming no active auth code depends on them. The `users.firebase_uid` field and related index are removed by a Drizzle migration.

## Removal Scope

Remove active Firebase surfaces:

- Firebase config: `firebase.json`, `.firebaserc`.
- Firebase Functions app: `apps/functions`.
- Firebase emulator setup and docs.
- Firebase package dependencies and imports.
- Firebase export/backfill scripts and UI pages.
- Firebase-specific schema fields, tests, and documentation.
- CI or package scripts that run Firebase emulators or deploy functions.

## Non-Goals

- Do not replace Drizzle with another ORM.
- Do not migrate Better Auth to a hosted auth provider in this branch.
- Do not provision Vercel Marketplace storage from code.
- Do not remove historical docs unless they mislead active setup; archive when useful.

## Verification

The migration is acceptable when:

- `rg -n "firebase|firebase-admin|firebase-functions|firestore|emulator" apps packages scripts .github docs` returns no active references except archived migration history, if any.
- `pnpm -w type-check` passes.
- `pnpm lint` passes.
- `pnpm --filter web build` passes.
- Relevant Vitest and Playwright smoke tests pass or any existing unrelated failures are documented with evidence.
