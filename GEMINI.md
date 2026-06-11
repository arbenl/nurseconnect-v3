# NurseConnect V3 — Gemini Guidance

> **Constitution first:** `AGENTS.md` is the binding NurseConnect Enterprise
> Constitution. Read it, then the authority chain it defines
> (`docs/plans/current-program.md` → `current-tracker.md` →
> `ENTERPRISE_UPGRADE_TRACKER.md`). The Four Mandates apply to every change:
> no bare-row mutations (outbox doctrine), no cross-domain SQL joins, no raw
> string states (phantom types), no PR without `verify-slice --required-gates`.
> Execute tracker slices only through the `nurseconnect-execution-runner` skill
> (`.gemini/skills/nurseconnect-execution-runner/SKILL.md`).

NurseConnect V3 is a Vercel-native Next.js healthcare staffing platform, mid
**Phase C Enterprise Upgrade**. Do not add Firebase, Firestore, Firebase Auth,
Firebase Functions, or emulator workflows — Firebase belongs to git history only.

## Stack

- Runtime: Next.js 14 App Router in `apps/web`; Vercel previews + production
- Database: PostgreSQL via `packages/database` (Drizzle); `organizations` +
  `org_memberships` with fail-closed RLS; `withTenantContext` GUC wrapper
- Auth: Better-Auth only, bridged via enforced `users.auth_id`
- Tests: Vitest (jsdom + node), Playwright (API E2E blocking, UI smoke)

## Local Setup

1. `pnpm install`
2. Copy `apps/web/.env.example` → `apps/web/.env.local`
3. `docker compose up -d`
4. `pnpm db:migrate`
5. `pnpm --filter web dev`

## Vercel

- `vercel link`, then `vercel env pull .env.local`
- Production env: `APP_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`,
  `DATABASE_URL`, optional `DATABASE_POOL_URL`

## Validation (full lane — do not cherry-pick)

- `pnpm -w type-check` · `pnpm lint` · `pnpm test:ci`
- `pnpm architecture:boundaries` · `pnpm modularity:guard` · `pnpm env:check`
- `pnpm --filter web test:api` · `pnpm --filter web build` · `pnpm gate:e2e`
- Slice merges additionally require `pnpm verify-slice` (static + required
  gates, including ent-* once NC-EG-01 lands) per the constitution.
