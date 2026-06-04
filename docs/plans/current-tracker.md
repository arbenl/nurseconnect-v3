---
plan_role: canonical_tracker
status: active
source_of_truth: false
authority_note: "current-program.md is the singular source of truth; this tracker defers to it on conflict."
owner: platform
last_reviewed: 2026-06-04
current_program_path: docs/plans/current-program.md
architecture_tracker_path: docs/plans/nurseconnect-enterprise-architecture-tracker.md
verification_command: pnpm verify-slice
---

# NurseConnect Current Tracker

> Authority: This is the repo-canonical active tracker for NurseConnect enterprise-readiness execution. Task-level status changes should be reflected here or in the linked architecture tracker.

## Active Queue

| ID | Status | Owner | Work | Exit Criteria |
|---|---|---|---|---|
| `NC-E0-00` | `completed` | platform | Establish canonical program/tracker, NurseConnect slice-runner guidance, closeout discipline, and repo-owned merge-gate artifacts. | Canonical docs agree on active program, active tracker, next slice, invariants, falsifiable slice rules, design-review gate, PR closeout, promotion rules, CODEOWNERS, branch-protection policy, and PR evidence requirements. |
| `NC-E0-01` | `completed` | platform + identity | Enforce identity bridge (`users.auth_id`). | PR #73 merged at `d636a890288955c0b5a5767c05956310d4a89bfb`; reconciliation report exists; orphan policy recorded; FK/NOT NULL migration is staged behind shell lifecycle; invariant tests and required checks passed. |
| `NC-E0-02` | `completed` | platform + auth | Production email verification rollout gate. | PR #75 merged at `f534fd797378484820d42d612dcc94cbbdf48a33`; production auth config requires email verification; dev/test remain usable; rollout runbook exists; main CI regression fixed by PR #76 at `308d4d255f5da976480d591825d60b23953b7a34`. |
| `NC-E0-03` | `completed` | platform + security | Env and secret-handling checks. | PR #78 merged at `ec3a0f7845b73235aaf3200528728beea873c754`; runtime env vars are validated/documented; `pnpm env:check` remains required; secret scanning remains fail-closed; CI, Sonar, GitGuardian, PR Finalizer, API E2E, UI smoke, and post-merge strict release gates passed. |
| `NC-E0-04` | `ready` | platform | Repo hygiene and generated artifact cleanup. | Generated artifacts are untracked/ignored; no Firebase source remains. |
| `NC-E0-05` | `planned` | architecture + qa | Module-boundary enforcement. | CI fails on illegal cross-domain imports; existing package boundaries are encoded in a deterministic check. |
| `NC-E0-06` | `planned` | ops | Disaster recovery baseline. | DR runbook records RPO/RTO, backup assumptions, and restore-drill evidence. |

## Next Slice

```text
NC-E0-04 / codex/repo-hygiene
```

Rationale:

- PR #78 completed the env and secret-handling checks slice at `ec3a0f7845b73235aaf3200528728beea873c754`.
- Repo hygiene is the next cheapest Phase 0 guardrail before module-boundary enforcement, DR evidence, tenant/RLS, outbox, CRM, or compliance slices.
- This keeps generated output, obsolete source, and ignored artifacts from obscuring later architecture and verification changes.

## Recent Closeout Evidence

| Slice | PR | Merge Commit | Gate Summary |
|---|---|---|---|
| `NC-E0-01 / phase-0-identity-link` | `https://github.com/arbenl/nurseconnect-v3/pull/73` | `d636a890288955c0b5a5767c05956310d4a89bfb` | `PR Finalizer`, Sonar, GitGuardian, unit, DB, E2E API, and UI smoke gates passed. |
| `NC-E0-02 / production-email-verification` | `https://github.com/arbenl/nurseconnect-v3/pull/75` | `f534fd797378484820d42d612dcc94cbbdf48a33` | Production email verification rollout controls, runbook, required gates, Sonar, GitGuardian, PR Finalizer, E2E API, and UI smoke passed; post-merge main CI harness regression fixed by PR #76 at `308d4d255f5da976480d591825d60b23953b7a34`. |
| `NC-E0-03 / env-secret-checks` | `https://github.com/arbenl/nurseconnect-v3/pull/78` | `ec3a0f7845b73235aaf3200528728beea873c754` | Env validation, secret-handling documentation, CI, Sonar Quality Gate, Sonar PR Summary, Sonar Coverage, GitGuardian, PR Finalizer, API E2E, UI smoke, and post-merge strict release gate passed. |

## Status Rules

- `planned`: accepted work, not ready to start.
- `ready`: next valid slice if prerequisites are met.
- `in_progress`: active local or branch work.
- `review`: implemented, awaiting reviewer/gate/PR outcome.
- `completed`: merged or otherwise closed with evidence.
- `blocked`: cannot progress without an explicit decision or external dependency.
