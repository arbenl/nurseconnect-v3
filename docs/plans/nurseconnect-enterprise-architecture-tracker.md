---
plan_role: architecture_tracker
status: active
source_of_truth: false
authority_note: "current-program.md is the singular source of truth; this tracker defers to it on conflict."
owner: platform
last_reviewed: 2026-06-05
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
| `NC-E1-01` | `completed` | `tenant-model-decision` | Decide flat org vs org+branch. | ADR-001 accepted organization plus branch/facility/location from v1; marketplace demand is tenant/facility scoped; nurse supply is platform-level only for non-PHI routing identity; jurisdiction is compliance/operating scope, not tenant boundary; debate evidence recorded in `docs/reviews/nc-e1-01-tenant-model-debate.md`. | High |
| `NC-E1-02` | `completed` | `rls-platform-mechanism` | Add tenant context wrapper, query helpers, DB role assertion. | PR #87 merged at `14c522558b630eb1ff3a2760dd27cac858ea0a8c`; RLS mechanism tests pass; app can refuse unsafe DB roles through the fail-closed role assertion; runbook records nurse platform-vs-tenant data classification, transaction-local tenant context, pooling cleanup, and regional/data-residency guardrails before schema work. | High |
| `NC-E1-03` | `completed` | `default-tenant-backfill-plan` | Define expand/contract tenant migration. | PR #89 merged at `15a6c9ebe688a6174a1e5620e33ffd986f90e04d`; default tenant/backfill plan and observe-before-enforce mechanism are documented in `docs/runbooks/default-tenant-backfill-plan.md`, including default org/facility/jurisdiction bootstrap, table classification, out-of-band DB access evidence, data-audit and PHI-classification gates, pooler/callsite constraints, and pause/rollback gates. | High |
| `NC-E1-04` | `completed` | `tenant-isolation-tests` | Add tenant isolation abuse tests. | PR #91 merged at `81035fad9d1fea3e17c0d43731d8ab9fdcf31901`; versioned tenant-isolation contract, readiness/guard/enforce harness modes, focused script tests, pooled-connection assertion reference, runbook, model-review disposition, verify-slice static/required gates, CI, Sonar, GitGuardian, PR Finalizer, API E2E, and UI smoke passed. | High |

## NC-E2 — Identity/AuthZ Platform

| ID | Status | Slice | Work | Acceptance Criteria | Risk |
|---|---|---|---|---|---|
| `NC-E2-01` | `completed` | `platform-identity` | Move current-user resolution into one platform identity boundary. | PR #93 merged at `b46861d353cc196ffbfaf1a456952414ff28bae0`; `/api/me/profile` and `/api/me/notifications` resolve current-user/role state through centralized identity boundaries; the legacy cached-user helper was removed; direct `users.authId` current-user lookups are blocked outside approved identity/schema/test boundaries; Copilot findings, verify-slice static/required gates, CI, Sonar, GitGuardian, PR Finalizer, API E2E, and UI smoke passed. | Medium |
| `NC-E2-02` | `completed` | `tenant-memberships` | Add org membership model after tenant shape decision. | PR #96 merged at `b0fa47381b3daa6db2c744cbc80b20a59ffdd54f`; organizations and org_memberships schema/migration landed; org_memberships has fail-closed RLS; tenant-scoped membership helpers and default-org admin bootstrap are tested; tenant-isolation contract/harness understands tenant boundary tables; Copilot bootstrap slug finding was fixed; local verify-slice static/required gates, CI, Sonar, GitGuardian, PR Finalizer, API E2E, and UI smoke passed. | High |
| `NC-E2-03` | `ready` | `platform-authz` | Add in-process tenant/resource-aware policy functions. | Policy matrix covers allow/deny/cross-tenant/PHI field cases. | High |

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
