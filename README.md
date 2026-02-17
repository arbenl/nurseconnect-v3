# NurseConnect V3

![CI](https://github.com/arbenl/nurseconnect-v3/actions/workflows/ci.yml/badge.svg)

NurseConnect is a healthcare platform connecting patients with local nurses for at-home care services.
**V3 is Postgres/Drizzle + Better-Auth. Firebase has been removed.**

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL (Drizzle ORM)
- **Auth**: Better-Auth
- **Monorepo**: Turborepo + pnpm

## Prerequisites
- Node.js >= 20
- pnpm >= 9
- Docker (for local database)

## Getting Started

1. **Install Dependencies**
   ```bash
   pnpm install
   ```

2. **Environment Setup**
   Copy the example environment file:
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   # Update DATABASE_URL in .env.local if needed (defaults match docker-compose)
   ```

3. **Start Database**
   Start the local PostgreSQL instance via Docker:
   ```bash
   docker compose up -d
   ```

4. **Initialize Database**
   Run migrations to set up the schema:
   ```bash
   pnpm db:migrate
   # Optional (prototyping): pnpm db:push
   ```

5. **Start Development Server**
   ```bash
   pnpm dev
   # or: pnpm --filter web dev
   ```
   - Web App: http://localhost:3000

6. **Verify Health**
   ```bash
   curl -s http://localhost:3000/api/health/db
   ```
   - Expected response: `{"ok":true,"db":"ok"}`

## Commands

- `pnpm gate:fast`: Comprehensive fast gate (Type-check + Lint + Unit tests).
- `pnpm gate:e2e`: Primary E2E gate (API-first tests).
- `pnpm db:generate`: Generate Drizzle migrations.
- `pnpm db:migrate`: Run migrations.
- `pnpm type-check`: Run TypeScript validation.
- `pnpm lint`: Run ESLint.

## Testing Strategy

We use a split strategy to ensure both speed and reliability:

### 1. API E2E Tests (Primary Gate)

Fast (~20s) and covering critical business logic. These are the main gates for CI.

- **Run all**: `pnpm gate:e2e`
- **Logic**: `apps/web/tests/e2e-api`

### 2. UI E2E Tests (Quarantined)

Browser-heavy Playwright tests. Quarantined in CI to prevent flakiness from blocking main builds.

- **Run locally**: `pnpm --filter web test:e2e:ui`
- **Source**: `apps/web/tests/e2e-ui`

### 3. Integration & Unit

- **DB/API**: `pnpm --filter web test:api`
- **Unit**: `pnpm test:ci`

## Architecture

- `apps/web`: Main Next.js application.
- `packages/database`: Drizzle ORM schema and client.
- `packages/ui`: Shared UI components.
- `packages/contracts`: Shared Zod schemas and types.

## License

MIT
