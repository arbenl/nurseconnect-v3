# Project Architecture: NurseConnect V3 Monorepo

This document outlines the project structure and architectural state of the `nurseconnect-v3` monorepo.

## 1. Current State (Post-Hardening)

- **Internal packages**: `@nurseconnect/contracts`, `@nurseconnect/ui`, `@nurseconnect/tsconfig`, `@nurseconnect/database`
- **Auth**: NextAuth (legacy, Phase 2 target: Better-Auth + Postgres)
- **Database**: PostgreSQL via Drizzle ORM (`packages/database`)
- **Firebase**: Env vars rejected at boot by `apps/web/src/env.ts`; runtime Firebase code still exists in legacy files (Phase 3 removal target)
- **Feature flags**: `FEATURE_BACKEND_*` locked to `postgres` only

## 2. Core Structure

- **`apps/web/`**: Next.js application (main UI)
- **`packages/contracts/`**: Shared Zod schemas and types
- **`packages/database/`**: Drizzle ORM schema, migrations, and DB client (Postgres)
- **`packages/tsconfig/`**: Shared TypeScript configurations
- **`packages/ui/`**: Shared UI component library
- **`scripts/`**: Utility scripts (`env-check.mjs`, `seedUser.js`, etc.)
- **`docs/migration/`**: Migration planning docs (`data-sources.md`)

## 3. Key Tooling

- **pnpm + Turborepo**: Workspace management and task orchestration
- **TypeScript 5.x**: Strict type-checking
- **Vitest**: Unit + emulator tests (split configs)
- **Drizzle ORM**: Schema definition, migrations, Postgres client
- **@t3-oss/env-nextjs**: Runtime environment validation

## 4. Known Issues

| Issue | Impact | Resolution |
|---|---|---|
| Dual Zod versions (root `^3.25.76`, web `^4.0.17`) | Type-check errors in `env.ts` | Unify on Zod 4 monorepo-wide |
| `better-auth` not installed | Type errors on `auth.ts`, `auth-client.ts` | Install in Phase 2 |
| Legacy Firebase code in `src/lib/firebase*` | Dead code, won't execute (env rejected) | Remove in Phase 3 |
| NextAuth still active in middleware + pages | Cannot remove NEXTAUTH_* env vars yet | Replace in Phase 2 |
| `next@14` + `react@19` peer dep mismatch | Warnings only, builds succeed | Upgrade Next.js |

## 5. Firebase Status

**Firebase is not supported in V3.** The env validation (`apps/web/src/env.ts`) rejects 13 Firebase-related environment variables at boot time. Legacy Firebase runtime code still exists but cannot execute without configuration. Files to remove in Phase 3:

- `src/lib/firebaseClient.ts`
- `src/lib/firebase/client.ts`
- `src/lib/firebase/auth-events.ts`
- `src/lib/auth/config.ts` (FirestoreAdapter)
- `vitest.config.emu.ts` (Firebase emulator test config)

## 6. Configuration

- **Dependency Management**: Use `pnpm add --filter <workspace>` for workspace-specific deps
- **TypeScript Paths**: `@nurseconnect/*` packages resolve via workspace protocol
- **Env Validation**: All server env vars validated by `apps/web/src/env.ts` at import time
- **CI**: `unit` job (type-check, build, tests) + `db-sanity` job (Postgres migrations + health check)