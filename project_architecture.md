# Project Architecture: NurseConnect V3 Monorepo

NurseConnect V3 is a Vercel-native Next.js monorepo.

## Current Architecture

- `apps/web`: Next.js App Router application and API route handlers.
- `packages/database`: PostgreSQL schema, Drizzle migrations, and DB client.
- `packages/contracts`: Shared Zod contracts and types.
- `packages/domain-*`: Domain packages for identity, nurse, request, dispatch, and admin operations.
- `packages/platform-telemetry`: Shared structured logging utilities.
- `packages/ui`: Shared UI components.

## Runtime Model

- Vercel hosts previews and production deployments.
- Next.js route handlers and server modules own backend-for-frontend logic.
- PostgreSQL is the source of truth for domain state.
- Better Auth owns authentication and session state.

## Tooling

- pnpm and Turborepo manage workspace tasks.
- Drizzle manages schema and migrations.
- Vitest covers unit and integration tests.
- Playwright covers API and UI E2E tests.
- Vercel Observability receives runtime logs, traces, analytics, and speed insights.

## Boundaries

- Do not add Firebase, Firestore, Firebase Auth, Firebase Functions, or emulator workflows.
- Do not put privileged state changes in client components.
- Do not commit secrets. Use `.env.local` locally and Vercel environment variables for deployed environments.
- Keep deployment-specific behavior in Vercel config, environment variables, and Next.js server code.
