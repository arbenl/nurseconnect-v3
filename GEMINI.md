# NurseConnect V3 Gemini Guidance

NurseConnect V3 is a Vercel-native Next.js application. Do not add Firebase, Firestore, Firebase Auth, Firebase Functions, or emulator workflows.

## Stack

- Runtime: Next.js App Router in `apps/web`
- Deployment: Vercel previews and production deployments
- Database: PostgreSQL through `packages/database` and Drizzle
- Auth: Better Auth
- Tests: Vitest and Playwright

## Local Setup

1. Install dependencies with `pnpm install`.
2. Copy `apps/web/.env.example` to `apps/web/.env.local`.
3. Start local Postgres with `docker compose up -d`.
4. Run migrations with `pnpm db:migrate`.
5. Start the app with `pnpm --filter web dev`.

## Vercel Setup

- Link the repo with `vercel link`.
- Pull environment variables with `vercel env pull .env.local`.
- Configure production `APP_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `DATABASE_URL`, and optional `DATABASE_POOL_URL` in Vercel.
- Vercel automatically provides `VERCEL_URL` for preview deployments.

## Validation

- `pnpm -w type-check`
- `pnpm lint`
- `pnpm test:ci`
- `pnpm --filter web build`
- `pnpm gate:e2e`

Firebase compatibility belongs only in git history, not in active code or docs.
