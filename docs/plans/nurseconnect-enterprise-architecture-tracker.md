---
plan_role: architecture_tracker
status: active
source_of_truth: false
authority_note: "current-program.md is the singular source of truth; this tracker defers to it on conflict."
owner: platform
last_reviewed: 2026-06-04
program_path: docs/plans/nurseconnect-enterprise-architecture-program.md
current_tracker_bridge: docs/plans/current-tracker.md
---

# NurseConnect Enterprise Architecture Tracker

## NC-E0 — Operating System + Stabilization

| ID | Status | Slice | Work | Acceptance Criteria | Risk |
|---|---|---|---|---|---|
| `NC-E0-00` | `completed` | `program-closeout-and-gates` | Establish canonical program/tracker, slice philosophy, runner guidance, closeout discipline, and repo-owned merge-gate artifacts. | Canonical docs agree on active program, active tracker, next slice, invariants, falsifiable slice rules, design-review gate, PR closeout, next-slice promotion, CODEOWNERS, branch-protection policy, and PR evidence requirements. | Low |
| `NC-E0-01` | `completed` | `phase-0-identity-link` | Reconcile and enforce `users.auth_id`. | PR #73 merged at `d636a890288955c0b5a5767c05956310d4a89bfb`; reconciliation report, orphan policy, staged FK/NOT NULL plan, invariant tests, Sonar, and PR Finalizer passed. | Medium |
| `NC-E0-02` | `completed` | `production-email-verification` | Make email verification production-required with rollout controls. | PR #75 merged at `f534fd797378484820d42d612dcc94cbbdf48a33`; prod config requires verification; dev/test unaffected; auth E2E and rollout runbook exist; post-merge main CI fixed by PR #76 at `308d4d255f5da976480d591825d60b23953b7a34`. | Low-Medium |
| `NC-E0-03` | `completed` | `env-secret-checks` | Harden env and secret checks. | PR #78 merged at `ec3a0f7845b73235aaf3200528728beea873c754`; `pnpm env:check` validates required vars; Gitleaks remains fail-closed; CI, Sonar, GitGuardian, PR Finalizer, API E2E, UI smoke, and post-merge strict release gate passed. | Low |
| `NC-E0-04` | `completed` | `repo-hygiene` | Remove generated artifacts, tighten `.gitignore`, and calibrate lightweight docs-only gates. | PR #80 merged at `6ae17d68db4a86875b6049ddfccaedea82e15183`; build/test output is untracked/ignored; active Firebase source/config templates are removed or fail deterministic hygiene checks; docs-only gates avoid duplicate local release-gate cost; optional model critique debate writes receipts when warranted. | Low |
| `NC-E0-05` | `completed` | `module-boundary-guard` | Add deterministic module-boundary enforcement and 150-line modularity guard for new/modified files. | PR #82 merged at `505f8aae60cc3dbc7e19ef7384e1df94457d3b4c`; illegal cross-domain imports/re-exports fail CI; oversized new/growing source files fail except approved generated/migration/config exceptions. | Medium |
| `NC-E0-06` | `completed` | `dr-baseline` | Write and drill DR runbook. | PR #84 merged at `d20bb12fd791f77af2f2d3b9bdfffe0e6d613811`; DR runbook, RPO/RTO targets, backup/PITR assumptions, PHI-safe restore-drill evidence template, and launch-readiness DR links landed with required gates green. | Low |

## NC-E1 — Tenant/RLS Foundation

| ID | Status | Slice | Work | Acceptance Criteria | Risk |
|---|---|---|---|---|---|
| `NC-E1-01` | `blocked` | `tenant-model-decision` | Decide flat org vs org+branch. | First enterprise customer model documented; ADR-001 Decision B closed. | High |
| `NC-E1-02` | `planned` | `rls-platform-mechanism` | Add tenant context wrapper, query helpers, DB role assertion. | RLS mechanism tests pass; app refuses unsafe DB role in production-like config. | High |
| `NC-E1-03` | `planned` | `default-tenant-backfill-plan` | Define expand/contract tenant migration. | Default tenant/backfill plan and observe-before-enforce mechanism approved. | High |
| `NC-E1-04` | `planned` | `tenant-isolation-tests` | Add tenant isolation abuse tests. | Tenant A cannot read/write Tenant B in DB/API tests. | High |

## NC-E2 — Identity/AuthZ Platform

| ID | Status | Slice | Work | Acceptance Criteria | Risk |
|---|---|---|---|---|---|
| `NC-E2-01` | `planned` | `platform-identity` | Move current-user resolution into one platform identity boundary. | All role checks resolve through one function; bypass tests fail on alternate paths. | Medium |
| `NC-E2-02` | `planned` | `tenant-memberships` | Add org membership model after tenant shape decision. | Membership queries are tenant-scoped and tested. | High |
| `NC-E2-03` | `planned` | `platform-authz` | Add in-process tenant/resource-aware policy functions. | Policy matrix covers allow/deny/cross-tenant/PHI field cases. | High |

## NC-E3 — Notifications + Events Backbone

| ID | Status | Slice | Work | Acceptance Criteria | Risk |
|---|---|---|---|---|---|
| `NC-E3-01` | `planned` | `assignment-notification-safe` | Post-commit non-PHI assignment notification. | Notification sends after commit; no PHI in payload; provider failure does not roll back assignment. | Medium |
| `NC-E3-02` | `planned` | `outbox-schema` | Add persisted NurseConnect outbox table and contracts. | Atomicity tests prove rollback leaves no outbox row; committed state writes enqueue event. | High |
| `NC-E3-03` | `planned` | `outbox-worker` | Claim/publish/fail/dead-letter worker loop. | Retry/backoff/idempotency tests pass. | High |
| `NC-E3-04` | `planned` | `stale-open-redispatch` | Scheduled redispatch for stale open requests. | Stale open request is retried without duplicate assignment. | High |

## NC-E4 — Enterprise CRM Primitives

| ID | Status | Slice | Work | Acceptance Criteria | Risk |
|---|---|---|---|---|---|
| `NC-E4-01` | `planned` | `crm-entity-model` | Organizations, facilities, contacts model. | Contracts, schema, and tenant-scoped tests pass. | High |
| `NC-E4-02` | `planned` | `polymorphic-notes` | Notes across org/contact/facility/nurse/request. | PHI-safe visibility and audit tests pass. | Medium-High |
| `NC-E4-03` | `planned` | `tasks-work-queue` | Coordinator tasks and follow-up queue. | Task lifecycle tests and UI smoke pass. | Medium |
| `NC-E4-04` | `planned` | `activities-timeline` | Generalized activity timeline. | Request events still intact; activity projection works across entity types. | Medium |

## NC-E5 — Compliance/Observability Hardening

| ID | Status | Slice | Work | Acceptance Criteria | Risk |
|---|---|---|---|---|---|
| `NC-E5-01` | `planned` | `phi-classification` | Classify PHI columns and access surfaces. | PHI inventory covers schema and API responses. | High |
| `NC-E5-02` | `planned` | `phi-read-audit` | Audit reads of PHI-bearing resources. | Read audit tests prove access is logged without leaking PHI in logs. | High |
| `NC-E5-03` | `planned` | `field-encryption` | Encrypt sensitive PHI fields after key-management ADR. | Encryption round-trip and migration tests pass. | High |
| `NC-E5-04` | `planned` | `ops-slos-audit-export` | SLOs, alerting, and exportable audit evidence. | SLO dashboard/runbook and export test exist. | Medium |

## NC-E6 — Platformization

| ID | Status | Slice | Work | Acceptance Criteria | Risk |
|---|---|---|---|---|---|
| `NC-E6-01` | `planned` | `versioned-public-api` | Versioned API + OpenAPI generated from `contracts`. | OpenAPI emitted from contracts; version-compatibility tests pass. | Medium |
| `NC-E6-02` | `planned` | `tenant-webhooks` | Outbound webhooks for tenants. | Signed, retried, tenant-scoped delivery tests pass. | Medium |
| `NC-E6-03` | `planned` | `integration-adapters` | EHR/HL7-FHIR + PSP + calendar/SMS adapters behind an integration layer. | Adapter sandbox E2E; no domain coupling to vendor SDKs. | High |
| `NC-E6-04` | `planned` | `enterprise-admin-console` | Tenant self-service admin (`apps/admin`). | Tenant-scoped admin actions audited and policy-gated. | Medium |
| `NC-E6-05` | `deferred` | `physical-tenant-isolation` | Optional schema/DB-per-tenant — only if a buyer contractually requires it. | Decision gated on a signed requirement; not built speculatively. | High |
