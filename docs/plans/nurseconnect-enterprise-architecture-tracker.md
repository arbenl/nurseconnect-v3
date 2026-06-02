---
plan_role: architecture_tracker
status: active
source_of_truth: true
owner: platform
last_reviewed: 2026-06-02
program_path: docs/plans/nurseconnect-enterprise-architecture-program.md
current_tracker_bridge: docs/plans/current-tracker.md
---

# NurseConnect Enterprise Architecture Tracker

## NC-E0 — Operating System + Stabilization

| ID | Status | Slice | Work | Acceptance Criteria | Risk |
|---|---|---|---|---|---|
| `NC-E0-00` | `in_progress` | `program-operating-system` | Establish canonical program/tracker, slice philosophy, and runner guidance. | Canonical docs agree on active program, active tracker, next slice, invariants, falsifiable slice rules, design-review gate, PR closeout, and next-slice promotion. | Low |
| `NC-E0-01` | `ready` | `phase-0-identity-link` | Reconcile and enforce `users.auth_id`. | Reconciliation report, orphan policy, migration/test plan, invariant tests. | Medium |
| `NC-E0-02` | `planned` | `production-email-verification` | Make email verification production-required with rollout controls. | Prod config requires verification; dev/test unaffected; auth E2E proves gates. | Low-Medium |
| `NC-E0-03` | `planned` | `env-secret-checks` | Harden env and secret checks. | `pnpm env:check` validates required vars; Gitleaks remains fail-closed. | Low |
| `NC-E0-04` | `planned` | `repo-hygiene` | Remove generated artifacts and tighten `.gitignore`. | Build/test does not reintroduce tracked generated files. | Low |
| `NC-E0-05` | `planned` | `module-boundary-guard` | Add deterministic module-boundary enforcement and 150-line modularity guard for new/modified files. | Illegal cross-domain imports fail CI; oversized new/modified source files fail except approved generated/migration/config exceptions. | Medium |
| `NC-E0-06` | `planned` | `dr-baseline` | Write and drill DR runbook. | Restore drill evidence captured. | Low |

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
