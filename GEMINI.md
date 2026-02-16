# NurseConnect — Emulator-First Developer Guide

This repo is a **pnpm monorepo** (Turborepo) with a **Next.js** app (`apps/web`).
NurseConnect lets patients request basic at-home care and nearby nurses accept jobs.
Auth is **Firebase Auth**, data is in **Cloud Firestore**, and **all local work runs
against emulators**.

---

## Prerequisites
- **Node.js** ≥ 20
- **pnpm**
- **Firebase CLI** (`npm i -g firebase-tools`)

## Repo Layout
- `apps/web` — Next.js application
- `packages/contracts` — shared Zod schemas & types (data contracts)
- `packages/ui` — shared UI (minimal for now)
- `packages/database/firestore.rules` — Firestore security rules (source of truth)

## Routes & Flow
- `/` (Home) — intro + links to Sign Up / Sign In
- `/signup` — create account (displayName, email, password) → auto sign-in → `/dashboard`
- `/login` — sign in (email, password) → `/dashboard`
- `/dashboard` — authenticated overview (requests/shifts)
- `/profile` — view/update profile (displayName, role)

Auth uses **NextAuth.js** (Credentials). Typical flows:
1) New user signs up → account created → auto sign-in → dashboard  
2) Existing user logs in → dashboard

---

## Emulator Environment — Single Source of Truth
These **must not change** (kept in `firebase.json` and `.env.local`):

- **Auth**: `127.0.0.1:9099`
- **Firestore**: `127.0.0.1:8080`
- **Emulator UI**: `127.0.0.1:4000`

### Local env (`apps/web/.env.local`)
```bash
# apps/web/.env.local
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-nurseconnect
NEXT_PUBLIC_FIREBASE_API_KEY=demo
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_USE_EMULATORS=true
# Optional for prod-like local:
# NEXTAUTH_SECRET=dev-dont-use-in-prod
```

---

## Quick Start (happy path)
1. **Install**  
   ```bash
   pnpm install
   ```
2. **Type-check**  
   ```bash
   pnpm type-check
   ```
3. **Unit tests (CI set)**  
   ```bash
   pnpm test:ci
   ```
4. **Start emulators** (new terminal)  
   ```bash
   pnpm -F web emu:start
   ```
5. **Seed demo user** (idempotent)  
   ```bash
   pnpm -F web emu:seed
   ```
6. **Emulator tests** (integration)  
   ```bash
   pnpm -F web emu:test
   ```
7. **Run dev server**  
   ```bash
   pnpm -F web dev
   # open http://localhost:3000
   ```

**Emulator UI:** http://127.0.0.1:4000  
**Auth:** 127.0.0.1:9099 **Firestore:** 127.0.0.1:8080

---

## Testing Matrix
- **Web unit tests:**  
  ```bash
  pnpm --filter web test
  ```
- **Contracts (schemas) tests:**  
  ```bash
  pnpm --filter contracts test
  ```
- **CI unit suite (all fast tests):**  
  ```bash
  pnpm test:ci
  ```
- **Web emulator tests (integration):**  
  ```bash
  pnpm -F web emu:test
  ```
- **Single file (debug):**  
  ```bash
  pnpm -F web test -- apps/web/src/app/api/profile/__tests__/route.test.ts
  ```

Configs (do not merge/change environments):
- `apps/web/vitest.config.ts` — unit (jsdom)
- `apps/web/vitest.config.emu.ts` — emulator tests (node)
- `packages/contracts/vitest.config.ts` — contracts unit (node)

---

## Seeder
Path: `apps/web/scripts/seedUser.js` (CommonJS). It is **idempotent** and:
1. Creates/ensures Auth user **`test@example.com` / `password123`** in the Auth emulator
2. Upserts the corresponding `/users/{uid}` doc in the Firestore emulator

Run:
```bash
pnpm -F web emu:seed
```

---

## Firestore Rules
- Source of truth: `packages/database/firestore.rules`
- Emulator tests will fail **intentionally** if a rule blocks a legit write/read.
  When that happens, minimally adjust rules, then re-run:
  ```bash
  pnpm -F web emu:test
  ```

---

## Common Pitfalls & Quick Fixes
**Ports in use**  
Another process is holding 9099 / 8080 / 4000.
```bash
lsof -ti :9099 :8080 :4000 | xargs kill -9 2>/dev/null || true
```

**Missing env**  
App isn’t connecting to emulators → ensure `apps/web/.env.local` exists and matches values above.

**Emulator not started**  
If any `auth/invalid-api-key` or network errors, make sure you ran:
```bash
pnpm -F web emu:start
```

**Login failing**  
Use the seeded account; if unsure, re-seed:
```bash
pnpm -F web emu:seed
```

**Vitest can’t find tests**  
Make sure you’re using the **package-local** configs (do not use a root config).

---

## Conventions
- **pnpm + Turborepo** for tasks
- **Vitest split:** unit vs emulator tests
- **NextAuth (Credentials)** for local emulator auth
- **Zod** schemas in `packages/contracts`
- **Emulator-only** locally: no external email/SMS providers, no live Firebase

---

## Stop & Reset (optional)
**Stop emulators:**
```bash
lsof -ti :9099 :8080 :4000 | xargs kill -9 2>/dev/null || true
```

**Reset local export (clean slate):**
```bash
rm -rf apps/web/.seed && git checkout -- apps/web/.seed 2>/dev/null || true
```