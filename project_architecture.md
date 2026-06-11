# Project Architecture: NurseConnect V3 Monorepo

> **⚠️ PHASE C ENTERPRISE UPGRADE IN PROGRESS.** This repository is being upgraded
> to the Interdomestik "Phase C Enterprise Standard": transactional outbox, CQRS
> boundaries (no cross-domain SQL joins), type-level guards (phantom types), and
> fail-closed `ent-tm` / `ent-dlv` / `ent-perf` verification gates.
> Before any work, read `docs/plans/current-program.md` (the singular source of
> truth) and `docs/plans/ENTERPRISE_UPGRADE_TRACKER.md` (the Phase C execution map).
> Do not assume this document alone is sufficient context.

NurseConnect V3 is a Vercel-native Next.js monorepo: a healthcare staffing
marketplace connecting patients with nearby nurses for in-home visits.

## Current Architecture (verified 2026-06-10)

- `apps/web`: Next.js 14 App Router application, API route handlers (BFF), and
  server services (`src/server/*`).
- `packages/database`: PostgreSQL schema (Drizzle), migrations, pooled client,
  **tenant context machinery** (`tenant-context.ts`: `withTenantContext`,
  `assertTenantContext`, branded `OrganizationId`) and the fail-closed RLS
  connection-role assertion (`rls-role-assertion.ts`).
- `packages/contracts`: Shared Zod contracts and types (contract-first API).
- Domain packages: `domain-identity`, `domain-request`, `domain-dispatch`,
  `domain-nurse`, `domain-admin-ops`, `domain-payments`, `domain-visit`,
  `domain-referral`.
- `packages/platform-telemetry`: structured logging + admin-audit helper.
- `packages/ui`, `packages/tsconfig`: shared UI primitives and TS config.

## Data Model (16 schema files)

Core: `users`, `nurses`, `patients`, `referral-partners`, `service-requests`,
`assignments`, `visits`, `nurse-locations`, `service-areas`,
`payment-authorizations`, `nurse-payouts`.

Evidence/audit: `service_request_events` (append-only request event log,
co-committed with state changes) and `admin_audit_logs`.

Tenancy: `organizations` + `org_memberships` (fail-closed RLS, role/status/source
enums) landed in NC-E2-02 (PR #96). **Domain tables do not yet carry
`organization_id`** — the expand/contract backfill is planned in
`docs/runbooks/default-tenant-backfill-plan.md` and tracked in the Phase C tracker.

Auth: Better-Auth tables (`auth_users` etc., text ids) bridged to domain `users`
(uuid) via enforced `users.auth_id` (NC-E0-01).

## Runtime Model

- Vercel hosts previews and production. PostgreSQL is the source of truth.
- Route handlers parse with contracts, authorize via centralized identity/role
  resolution (NC-E2-01), then call `server/*` orchestration → domain packages.
- Dispatch is currently **synchronous inside the create-request transaction**
  (`server/requests/allocate-request.ts`, `FOR UPDATE SKIP LOCKED`). There is
  **no outbox/worker yet** — ADR-004 decided a Postgres-native outbox; build is
  tracked as NC-E3 in the Phase C tracker. Until it lands, treat all side
  effects as unreliable-by-design and do not add new inline fan-out.

## Boundaries & Guards

- CI enforces module boundaries (`pnpm architecture:boundaries`), a 150-line
  modularity guard, and an AST guard blocking direct `users.authId` current-user
  lookups outside the identity boundary.
- Known Phase C debt: cross-domain SQL joins exist in `domain-referral`,
  `domain-visit`, and `domain-nurse` projections; their elimination (CQRS read
  models) is tracked as the NC-CQ band. Do not add new cross-domain joins.
- Type-level guards: only `OrganizationId` is branded today. `AuthorizedTransition`
  and `MedicalEvidence` brands are being introduced via the amended NC-E2-03 slice.
- Do not add Firebase, Firestore, Firebase Auth, Firebase Functions, or emulators.
- Do not put privileged state changes in client components.
- Do not commit secrets (`.env.local` locally; Vercel env vars deployed).
- PHI posture is not yet enterprise-grade (no field encryption, read audit, or
  erasure machinery — NC-E5 band). Never log or message PHI; notifications must
  remain post-commit and non-PHI per program invariants.

## Tooling

- pnpm + Turborepo; Drizzle migrations; Vitest (jsdom + node lanes); Playwright
  (API-first E2E blocking, UI smoke); SonarQube; Gitleaks/GitGuardian fail-closed.
- Merge contract: `pnpm verify-slice` (static + required gates) per
  `docs/runbooks/slice_workflow.md` and `AGENTS.md`. The Phase C program bolts
  `ent-tm`, `ent-dlv`, and `ent-perf` assertions onto this contract (NC-EG band).
