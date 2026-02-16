# IMPORTANT RULES — NurseConnect (Emulator-First)

This document constrains **all automated edits** (e.g., Gemini CLI) for the NurseConnect monorepo.
Follow these rules exactly. If a task requires breaking any rule, STOP and output a note titled
**REQUEST-EXCEPTION** describing the minimal deviation and why.

---

## 1) Scope & Outputs

- **Scope:** `apps/web`, `packages/contracts`, `packages/database/firestore.rules`, CI config, and test configs only.
- **Output format:** For code changes, return a **unified diff** per file (no shell output). If generating a new file, include full file content and exact path.
- **No side effects:** Do not run git commands; do not change repo history text. Only produce diffs/content.

---

## 2) Emulator-Only, No Live Services

- **DO NOT** connect to live Firebase projects or third-party providers in local/dev flows.
- Must use these **fixed emulator ports** (single source of truth):
  - Auth: `127.0.0.1:9099`
  - Firestore: `127.0.0.1:8080`
  - Emulator UI: `127.0.0.1:4000`
- **Do not change** `firebase.json` emulator ports.
- **Do not remove** or bypass `.env.local` flags that enable emulator mode.

---

## 3) Environment Variables (apps/web/.env.local)

Must exist and must not be renamed or removed:
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-nurseconnect
NEXT_PUBLIC_FIREBASE_API_KEY=demo
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_USE_EMULATORS=true

---

## 4) Authentication & Data

- **Auth:** NextAuth **Credentials** provider only (local emulator). **Do not** introduce OAuth/SAML/etc.
- **User model:** Keep `/users/{uid}` doc creation/updates consistent with existing profile flows.
- **Do not** change Firestore collection names or document shapes without adding/adjusting tests.

---

## 5) File Boundaries (Do / Don’t)

**Allowed to change**
- `apps/web/src/**` (pages, API routes, components, tests)
- `apps/web/vitest.config.ts`, `apps/web/vitest.config.emu.ts`, `apps/web/vitest.setup*.ts`
- `apps/web/scripts/seedUser.js` (must stay idempotent, emulator-only)
- `packages/contracts/**` (Zod schemas + tests)
- `packages/database/firestore.rules` (with matching tests)

**Do NOT change**
- Emulator ports in `firebase.json`
- Repository toolchain (pnpm/turbo) structure
- Root Vitest config (we use per-package configs only)
- NextAuth strategy (keep Credentials)
- Telemetry/analytics additions (none)

---

## 6) Testing Rules (must pass)

- **Unit (web):** `pnpm --filter web test`
- **Contracts:** `pnpm --filter contracts test`
- **CI unit suite:** `pnpm test:ci`
- **Emulator integration (web):** `pnpm -F web emu:test`  
  - Must not hit network; must seed `test@example.com / password123`.
  - If Firestore rules block legitimate writes, adjust rules minimally and update tests.

When adding code, include **at least one** matching unit/integration test.

---

## 7) Performance, Security, UX (minimums)

- **Security:** Validate inputs with Zod on API routes; forbid role self-escalation; rate-limit sensitive endpoints where present.
- **Perf:** Avoid heavyweight deps; prefer tree-shakable utilities; no blocking network calls in React Server Components.
- **UX:** Keep forms accessible; show inline error states; don’t regress existing flows (signup → auto-signin → dashboard).

---

## 8) PR Etiquette (for generated changes)

- Create small, focused diffs with descriptive titles, e.g.:
  - `feat(web): profile PUT validation (zod) + tests`
  - `test(web): fix db-admin mock hoisting for profile API`
- Include **What changed / Why / How tested** in the body (reference commands above).

---

## 9) Known Invariants (do not “clean up”)

- Separate Vitest configs:  
  - `apps/web/vitest.config.ts` (jsdom, unit)  
  - `apps/web/vitest.config.emu.ts` (node, emulator)
- Seeder is **CommonJS** and **idempotent**.
- `packages/contracts` is the source of truth for shared types (Zod).

---

## 10) Failure Handling

If a command fails during your workflow:

1. Output the exact command and stderr.
2. Provide a **minimal** patch to fix the immediate cause.
3. Re-run only the **relevant** test command(s).
4. Do **not** mutate unrelated configs or ports to “make it pass”.

---

## 11) Example Task Template (Gemini CLI)

> **Goal:** Fix profile API test flake due to mock hoisting.  
> **Files:** `apps/web/src/app/api/profile/__tests__/route.test.ts` only.  
> **Constraints:** Keep emulator setup unchanged; unified diff output only.  
> **Steps:**  
> 1) Hoist `vi.mock('@/lib/firebase/db-admin', …)` to the top.  
> 2) Dynamically import route handlers **after** mocks.  
> 3) Ensure mock returns `{ db: { collection: () => ({ doc: () => ({ get, set }) }) } }`.  
> 4) Run: `pnpm --filter web test -- apps/web/src/app/api/profile/__tests__/route.test.ts`.  
> 5) If pass, run full: `pnpm --filter web test`.  
> **Output:** Unified diff + brief test log summary.

---

Adhering to these rules keeps development **predictable**, **local-only**, and **green**.