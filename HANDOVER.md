# NurseConnect V3 — Handover

**Repo:** `https://github.com/arbenl/nurseconnect-v3`
**Last updated:** 2026-06-10
**Stack:** Next.js 14 (App Router) + TypeScript + Tailwind/shadcn + PostgreSQL + Drizzle + Better-Auth
**Monorepo:** pnpm + Turborepo

> **⚠️ PHASE C ENTERPRISE UPGRADE IN PROGRESS — READ THIS FIRST.**
> NurseConnect is mid-upgrade to the Interdomestik "Phase C Enterprise Standard"
> (transactional outbox, CQRS boundaries, phantom-type guards, fail-closed
> `ent-tm`/`ent-dlv`/`ent-perf` gates). Any future reader — human or AI — must
> treat the following as the authority chain, in order:
>
> 1. `docs/plans/current-program.md` — **singular source of truth**
> 2. `docs/plans/current-tracker.md` — active slice queue
> 3. `docs/plans/ENTERPRISE_UPGRADE_TRACKER.md` — Phase C execution map
> 4. `AGENTS.md` — slice workflow + merge contract
>
> Earlier versions of this file (≤2026-02-19) described a pre-enterprise roadmap
> ("PR-4.1 admin console next"). That roadmap is **obsolete**. Do not execute it.

---

## 1) Executive Summary

NurseConnect V3 is a healthcare staffing marketplace (patients ↔ in-home nurses)
built as a modular monolith. Engineering hygiene is strong (contract-first Zod
APIs, domain packages, race-safe `FOR UPDATE SKIP LOCKED` dispatch, append-only
request event log, mature CI). The active program — **Enterprise Architecture
Finalization** — is closing the gap between that CI culture and the runtime
guarantees an enterprise healthcare platform requires: tenancy/RLS over real
data, an async outbox backbone, type-level mutation guards, and PHI lifecycle
controls.

### Completed program slices (all merged with evidence; see current-tracker.md)

- **NC-E0 (stabilization, complete):** enforced `users.auth_id` identity bridge
  (PR #73); production email verification (PR #75/#76); env/secret checks
  (PR #78); repo hygiene (PR #80); module-boundary + 150-line modularity guards
  (PR #82); DR baseline runbook with RPO/RTO (PR #84).
- **NC-E1 (tenant/RLS foundation, complete):** ADR-001 tenant shape =
  organization + branch/facility/location (PR #86); RLS platform mechanism —
  `withTenantContext` GUC wrapper + fail-closed role assertion (PR #87);
  default-tenant backfill plan (PR #89); tenant-isolation abuse-test harness
  (PR #91).
- **NC-E2 (identity/authz, in progress):** centralized current-user resolution +
  AST boundary guard (PR #93); `organizations` + `org_memberships` schema with
  fail-closed RLS and membership helpers (PR #96). **Next slice in this band
  (after NC-EG merges): amended `NC-E2-03 / platform-authz` — policy functions
  *plus* phantom-type guards (`AuthorizedTransition`, `MedicalEvidence`).**

### Honest current-state limits (do not paper over these)

- **No outbox.** Dispatch and all side effects run synchronously inside the
  create-request transaction; nothing retries stale `open` requests. NC-E3.
- **No tenant columns on domain tables.** RLS protects `org_memberships` only;
  the expand/contract backfill has a plan but has not executed. NC-TB band.
- **One branded type** (`OrganizationId`). Lifecycle/credential mutations are
  not compiler-guarded. Amended NC-E2-03.
- **Cross-domain SQL joins** in `domain-referral`, `domain-visit`,
  `domain-nurse` violate CQRS boundaries. NC-CQ band.
- **PHI controls absent:** no column classification, read audit, field
  encryption, retention/erasure (crypto-shredding). NC-E5 band — the largest
  regulatory risk in the repo.

---

## 2) Repository Layout

- `apps/web` — Next.js app: UI, `app/api/**` route handlers (BFF), `src/server/*`
  orchestration.
- `packages/database` — Drizzle schema (16 files incl. `organizations`),
  migrations, pool, `tenant-context.ts`, `rls-role-assertion.ts`.
- `packages/contracts` — Zod schemas + shared types; everything imports from here.
- `packages/domain-*` — identity, request, dispatch, nurse, admin-ops, payments,
  visit, referral.
- `packages/platform-telemetry`, `packages/ui`, `packages/tsconfig`.
- `docs/` — ADRs (001–005), runbooks (RLS, backfill, DR, slice workflow),
  plans/trackers, reviews, `enterprise-readiness-report.md` (2026-06-02 baseline).

Key conventions: contract-first APIs; route handlers do telemetry → authz →
Zod parse → `server/*` → domain packages; domain logic stays pure in packages.

---

## 3) Local Development (known-good)

```bash
pnpm install
docker compose up -d        # local Postgres (Sonar: docker compose --profile sonar up -d)
pnpm db:migrate
pnpm dev
curl -s http://localhost:3000/api/health/db
```

Prereqs: Node ≥ 20, pnpm ≥ 9, Docker.

---

## 4) Auth & Identity

- Better-Auth is the only provider (NextAuth/Firebase fully removed).
- `users.auth_id` bridge is reconciled and enforced (NC-E0-01); direct
  `users.authId` current-user lookups outside the identity boundary **fail CI**
  (AST guard, `scripts/current-user-boundary.mjs`).
- `GET /api/me` is the authoritative client state source; admin RBAC validated
  via `GET /api/admin/ping` (401/403/200).
- Production requires email verification (NC-E0-02 rollout runbook).

## 5) Request Domain (stable since PR-4.0)

- Lifecycle: `open → assigned → accepted → enroute → completed`; reject reopens,
  cancel cancels; conflicts return 409; all actions row-locked + authorized.
- Allocation: race-safe nearest-nurse inside one transaction
  (`server/requests/allocate-request.ts`), NUMERIC lat/lng, deterministic
  tie-break. **Known Phase C debt: this transaction also performs dispatch
  inline — do not add further inline side effects; await NC-E3 outbox.**
- Audit: every lifecycle action appends to `service_request_events`;
  role-gated `GET /api/requests/[id]/events`.

---

## 6) Gates & Merge Contract (blocking)

Local lanes: `pnpm -w type-check` · `pnpm lint` · `pnpm test:ci` ·
`pnpm --filter web test:api` · `pnpm gate:e2e-api` · `pnpm gate:release` (full).

Slice contract (the `nurseconnect-execution-runner` SOP, which takes precedence;
`docs/runbooks/slice_workflow.md` is the legacy reference): design review →
`codex/<slice>` branch → `pnpm verify-slice` (keep `run_root`) → `--static` →
reviewer pool → fix `MUST_FIX` → `--required-gates` → PR with evidence → merge
only when CI, Sonar, GitGuardian, PR Finalizer, API E2E, and UI smoke are green.

**Phase C addition (NC-EG band):** `ent-tm` (threat-model assertion), `ent-dlv`
(data-lifecycle/PHI classification assertion), and `ent-perf` (performance
budget assertion) are being bolted onto `verify-slice --required-gates` as
fail-closed checks. Once NC-EG-01 lands, a PR **cannot be opened** without them.

Known CI failure modes (still current): Better-Auth `INVALID_ORIGIN` → set
`APP_URL`/`BETTER_AUTH_URL` to the test origin; sign-out 415 → send JSON +
`Content-Type: application/json`; missing tables → commit migrations +
`drizzle/meta/_journal.json`, run `pnpm db:migrate` first; UI Playwright is
quarantined to smoke — API-first E2E is the blocking lane.

---

## 7) What's Next

The full execution map is `docs/plans/ENTERPRISE_UPGRADE_TRACKER.md`. Summary
order: NC-EG (ent-* gates, first so everything after is born compliant) →
amended NC-E2-03 (platform-authz + phantom types) → NC-TB (tenant backfill
execution, RLS enforce over domain tables) → NC-E3 (outbox + worker +
redispatch) → NC-CQ (eliminate cross-domain joins) → NC-E5 (PHI classification,
read audit, field encryption, crypto-shredding, retention/erasure).

Do not start product features that touch state mutation, tenancy, or PHI
without checking the tracker for the slice that owns that surface.
