---
plan_role: canonical_tracker
status: active
source_of_truth: false
authority_note: "current-program.md is the singular source of truth; this tracker defers to it on conflict."
owner: platform
last_reviewed: 2026-06-02
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
| `NC-E0-02` | `ready` | platform + auth | Production email verification rollout gate. | Production auth config requires email verification; dev/test remain usable; rollout risk documented. |
| `NC-E0-03` | `planned` | platform + security | Env and secret-handling checks. | Runtime env vars are validated/documented; `pnpm env:check` remains required; secret scanning remains fail-closed. |
| `NC-E0-04` | `planned` | platform | Repo hygiene and generated artifact cleanup. | Generated artifacts are untracked/ignored; no Firebase source remains. |
| `NC-E0-05` | `planned` | architecture + qa | Module-boundary enforcement. | CI fails on illegal cross-domain imports; existing package boundaries are encoded in a deterministic check. |
| `NC-E0-06` | `planned` | ops | Disaster recovery baseline. | DR runbook records RPO/RTO, backup assumptions, and restore-drill evidence. |

## Next Slice

```text
NC-E0-02 / codex/production-email-verification
```

Rationale:

- PR #73 made shell claims and admin bootstrap depend on Better-Auth `emailVerified`.
- Production still needs an explicit email-verification rollout gate so those invariants hold in real auth flows.
- This remains smaller and safer than starting tenant/RLS work while production auth verification is not yet enforced.

## Recent Closeout Evidence

| Slice | PR | Merge Commit | Gate Summary |
|---|---|---|---|
| `NC-E0-01 / phase-0-identity-link` | `https://github.com/arbenl/nurseconnect-v3/pull/73` | `d636a890288955c0b5a5767c05956310d4a89bfb` | `PR Finalizer`, Sonar, GitGuardian, unit, DB, E2E API, and UI smoke gates passed. |

## Status Rules

- `planned`: accepted work, not ready to start.
- `ready`: next valid slice if prerequisites are met.
- `in_progress`: active local or branch work.
- `review`: implemented, awaiting reviewer/gate/PR outcome.
- `completed`: merged or otherwise closed with evidence.
- `blocked`: cannot progress without an explicit decision or external dependency.
