# NurseConnect V3

NurseConnect is a healthcare platform connecting patients with local nurses for at-home care services.
This V3 release is built as a monorepo using **Next.js**, **Tailwind CSS**, and **Firebase** (with local emulators).

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL (via Drizzle ORM) + Firestore (Legacy/Hybrid)
- **Auth**: Better-Auth + Firebase Auth (Migration in progress)
- **Monorepo**: Turborepo + pnpm

## Prerequisites
- Node.js >= 20
- pnpm >= 9
- Firebase CLI (`npm i -g firebase-tools`)

## Getting Started

1. **Install Dependencies**
   ```bash
   pnpm install
   ```

2. **Environment Setup**
   Copy the example environment file:
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   # Update values in .env.local if needed (defaults work for emulators)
   ```

3. **Start Development Server**
   This command starts the Next.js app and the Firebase Emulators.
   ```bash
   pnpm dev
   ```
   - Web App: http://localhost:3000
   - Emulator UI: http://localhost:4000

4. **Seed Data** (Optional)
   To seed a test user:
   ```bash
   pnpm -F web emu:seed
   ```

## Commands
- `pnpm type-check`: Run TypeScript validation across the monorepo.
- `pnpm lint`: Run ESLint.
- `pnpm test:ci`: Run unit tests.

## Architecture
- `apps/web`: Main Next.js application.
- `packages/database`: Drizzle ORM schema and client.
- `packages/ui`: Shared UI components.
- `packages/contracts`: Shared Zod schemas and types.

## License
MIT
