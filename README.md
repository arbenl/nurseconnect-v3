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
   # Update DB_URL in .env.local if needed (defaults match docker-compose)
   ```

3. **Start Database**
   Start the local PostgreSQL instance via Docker:
   ```bash
   docker compose up -d
   ```

4. **Initialize Database**
   Push the schema to the local database:
   ```bash
   pnpm db:push
   # Or for migrations: pnpm db:migrate
   ```

5. **Start Development Server**
   ```bash
   pnpm dev
   ```
   - Web App: http://localhost:3000

## Commands
- `pnpm type-check`: Run TypeScript validation across the monorepo.
- `pnpm lint`: Run ESLint.
- `pnpm test:ci`: Run unit tests.
- `pnpm db:generate`: Generate Drizzle migrations.
- `pnpm db:push`: Push Drizzle schema to DB (prototyping).

## Architecture
- `apps/web`: Main Next.js application.
- `packages/database`: Drizzle ORM schema and client.
- `packages/ui`: Shared UI components.
- `packages/contracts`: Shared Zod schemas and types.

## License
MIT
