# Contributing

This repo is a Vercel-native Next.js monorepo. Firebase, Firestore, Firebase Auth, Firebase Functions, and emulator workflows are intentionally unsupported.

## Common Checks

| Area | Run |
| --- | --- |
| TypeScript | `pnpm -w type-check` |
| Lint | `pnpm lint` |
| Web unit tests | `pnpm test:web` |
| Contracts/domain tests | `pnpm test:ci` |
| Web build | `pnpm --filter web build` |
| API E2E | `pnpm gate:e2e` |
| UI smoke | `pnpm --filter web test:e2e:ui-smoke` |

## Local Development

1. Install dependencies: `pnpm install`.
2. Copy env defaults: `cp apps/web/.env.example apps/web/.env.local`.
3. Start Postgres: `docker compose up -d`.
4. Run migrations: `pnpm db:migrate`.
5. Start the app: `pnpm --filter web dev`.

## Vercel Workflow

- Link once with `vercel link`.
- Pull environment variables with `vercel env pull .env.local`.
- Branch pushes create Vercel previews through Git integration.
- Production deploys use the configured Vercel production branch.

## Before Opening A PR

Run:

```bash
pnpm -w type-check
pnpm lint
pnpm test:ci
pnpm --filter web build
```

Add `pnpm gate:e2e` and Playwright UI checks when changing auth, routing, API routes, or user journeys.
