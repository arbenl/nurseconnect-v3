# Phase 0 — Stabilization Slice Plan

**Goal:** close the cheap, high-assurance gaps before any tenancy/CRM work, without changing **core request/dispatch behavior**. One slice (0.2, production email verification) **is** a deliberate, rollout-gated change to the auth flow — called out explicitly below; it is correct enterprise hardening, not a no-op. Everything else is behavior-preserving. Each item is a standalone `codex/<slice>` branch run through `pnpm verify-slice` (per `AGENTS.md` slice workflow). Ordered by dependency, not value — do them in this order.

These slices unblock ADR-002 (identity) and ADR-001 (tenancy) and harden CI so the later, riskier phases land on solid ground.

---

## Slice 0.1 — Enforce the identity link (`users.auth_id`)

**Why:** `users.auth_id` is nullable (`packages/database/src/schema/users.ts`); a null/mismatched link is a silent authz hole (report R2, ADR-002). Highest-value, lowest-cost fix.

**Work:**
1. Write a **reconciliation script** that reports `users` with null `auth_id` and `auth_id`s with no matching `auth_users.id` (and orphan `auth_users`). Run against a prod-like snapshot; resolve orphans per ADR-002 open item.
2. Migration: backfill, then add `NOT NULL` + FK `users.auth_id → auth_users.id`. (Better-Auth ids are `text`; keep the column `text`.)
3. Forbid bypassing the resolver: ensure all role checks route through `resolveCurrentSessionUser` (`apps/web/src/server/auth/session-user.ts`).

**Tests/verification:**
- `*.db.test.ts`: no `users` row has null `auth_id`; every `auth_id` resolves to an `auth_users` row.
- Existing auth e2e (`apps/web/tests/e2e-api`, `e2e-ui/smoke.spec.ts`) stays green.

**Files/areas:** `packages/database/src/schema/users.ts`, new migration under `packages/database/drizzle/`, `scripts/` (reconciliation), `apps/web/src/server/auth/*`.

**Risk:** medium — the backfill needs a clean orphan story; do it behind the reconciliation report first.

---

## Slice 0.2 — Production email verification  ⚠️ behavior change (rollout-gated)

**Why:** `requireEmailVerification: false` (`apps/web/src/lib/auth.ts`) is fine for dev, unacceptable for enterprise. **This changes the signup/sign-in flow in production** — flag it to stakeholders, gate it behind an env flag, and roll out deliberately (e.g. enable for new signups first, communicate to existing unverified users). It is not a behavior-preserving cleanup like the other slices.

**Work:** make `requireEmailVerification` environment-driven — `true` in production, current behavior in dev/test. Wire the verification email sender. Keep `autoSignIn` decision explicit.

**Tests/verification:**
- Config test: production config resolves `requireEmailVerification: true`.
- E2E: unverified user cannot reach gated portals in production mode; dev/test flows unaffected.

**Files/areas:** `apps/web/src/lib/auth.ts`, `apps/web/src/env.ts`, `.env.example`.

**Risk:** low — gate behind env so non-prod is unchanged.

---

## Slice 0.3 — Env & secret-handling checks

**Why:** harden config validation and keep the existing secret-scanning honest (report §2.12; Gitleaks already runs in `.github/workflows/ci.yml`).

**Work:**
1. Audit `apps/web/src/env.ts` (`@t3-oss/env-nextjs`) and `scripts/env-check.mjs`; ensure every required runtime var (incl. the `turbo.json` `globalEnv` list and future `DB_RLS_ROLE`) is validated and documented in `.env.example`.
2. Confirm `gitleaks` config (`.gitleaks.toml`) covers the repo and CI fails closed on findings.

**Tests/verification:**
- `pnpm env:check` passes on a complete env and fails with a clear message on a missing required var.
- CI: a planted dummy secret is caught by Gitleaks (one-off local check, not committed).

**Files/areas:** `apps/web/src/env.ts`, `scripts/env-check.mjs`, `.env.example`, `.gitleaks.toml`, `.github/workflows/ci.yml`.

**Risk:** low.

---

## Slice 0.4 — Repo hygiene / `.gitignore`

**Why:** committed artifacts pollute the repo and signal weak ignore discipline (report R9): `apps/web/firestore-debug.log`, `apps/web/test_output*.txt`, `server.pid`, `phase0_pack.zip`, `apps/web/tsconfig.tsbuildinfo`.

**Work:** remove these from version control (`git rm --cached`), add patterns to `.gitignore`. (Note: `firestore-debug.log` is a stray Firebase artifact; `project_architecture.md` explicitly bans Firebase — its presence is worth a quick check that no Firebase code remains.)

**Tests/verification:**
- `git status` clean after a build + test run (no tracked generated files reappear).
- `rg -i firebase apps/web/src packages` returns nothing in source (confirm the debug log is a leftover, not live usage).

**Files/areas:** `.gitignore`, the listed files.

**Risk:** none (no behavior change).

---

## Slice 0.5 — Module-boundary enforcement in CI

**Why:** the codebase's strong modular structure (`domain-*`, `contracts`, `platform-telemetry`) is currently convention, not enforced; it will rot under pressure (report §7, §10). Interdomestik already enforces this — port its approach.

**Work:**
1. Add a dependency-boundary check (dependency-cruiser or `eslint-plugin-boundaries`, or port Interdomestik's `scripts/check-architecture-boundaries.mjs` + `scripts/plan-conformance/boundary-contract-check.mjs`).
2. Encode the rule: domain packages may depend on `contracts` + `platform-*`, **never on each other's internals**; app may depend on domains; nothing depends on the app.
3. Wire it into `.github/workflows/ci.yml` as a required check and into `pnpm gate:fast`.

**Tests/verification:**
- The check fails on a deliberately-introduced illegal cross-domain import, passes on `main`.
- Added to CI required gates.

**Files/areas:** new `scripts/check-architecture-boundaries.mjs` (or config), `package.json` scripts, `.github/workflows/ci.yml`, root `turbo.json`.

**Risk:** low-medium — may surface a few existing violations to fix (that's the point).

---

## Slice 0.6 — DR baseline (docs-only)

**Why:** no documented RPO/RTO or restore drill (report R-DR, §10). Documentation-only, high assurance.

**Work:** write a DR runbook: managed-Postgres backup guarantees, PITR window, RPO/RTO targets, step-by-step restore, and a scheduled restore-drill cadence.

**Tests/verification:** one actual restore drill into a scratch database; capture evidence in the runbook.

**Files/areas:** `docs/runbooks/disaster-recovery.md`.

**Risk:** none.

---

## Exit criteria for Phase 0

- `users.auth_id` non-null + FK; reconciliation test green.
- Production email verification on; auth e2e green.
- `pnpm env:check` enforced; Gitleaks failing-closed.
- Repo clean of committed build artifacts.
- Module-boundary check required in CI.
- DR runbook written and one restore drilled.

All six pass `pnpm verify-slice` and the required-gates run. Only then start Phase 1 (ADR-001 tenancy), which depends on Slice 0.1 (identity) and Slice 0.5 (boundaries).
