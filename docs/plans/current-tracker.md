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
| `NC-E0-00` | `in_progress` | platform | Establish canonical program/tracker and NurseConnect slice-runner guidance. | `current-program.md`, `current-tracker.md`, architecture program/tracker, slice philosophy, and runner skill spec exist and point to the same next slice, design-review gate, PR lifecycle, closeout, and promotion rules. |
| `NC-E0-01` | `ready` | platform + identity | Enforce identity bridge (`users.auth_id`). | Reconciliation report exists; orphan policy recorded; `users.auth_id` is non-null/FK-enforced or migration plan is staged; invariant tests pass. |
| `NC-E0-02` | `planned` | platform + auth | Production email verification rollout gate. | Production auth config requires email verification; dev/test remain usable; rollout risk documented. |
| `NC-E0-03` | `planned` | platform + security | Env and secret-handling checks. | Runtime env vars are validated/documented; `pnpm env:check` remains required; secret scanning remains fail-closed. |
| `NC-E0-04` | `planned` | platform | Repo hygiene and generated artifact cleanup. | Generated artifacts are untracked/ignored; no Firebase source remains. |
| `NC-E0-05` | `planned` | architecture + qa | Module-boundary enforcement. | CI fails on illegal cross-domain imports; existing package boundaries are encoded in a deterministic check. |
| `NC-E0-06` | `planned` | ops | Disaster recovery baseline. | DR runbook records RPO/RTO, backup assumptions, and restore-drill evidence. |

## Next Slice

```text
NC-E0-01 / codex/phase-0-identity-link
```

Rationale:

- It closes the highest-value cheap security gap.
- It unblocks tenant membership and enterprise auth.
- It can be implemented without broad product behavior change.

## Status Rules

- `planned`: accepted work, not ready to start.
- `ready`: next valid slice if prerequisites are met.
- `in_progress`: active local or branch work.
- `review`: implemented, awaiting reviewer/gate/PR outcome.
- `completed`: merged or otherwise closed with evidence.
- `blocked`: cannot progress without an explicit decision or external dependency.
