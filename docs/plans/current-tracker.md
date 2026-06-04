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
| `NC-E0-03` | `completed` | platform + security | Env and secret-handling checks. | PR #78 merged at `ec3a0f7845b73235aaf3200528728beea873c754`; runtime env vars are validated/documented; `pnpm env:check` remains required; secret scanning remains fail-closed; CI, Sonar, GitGuardian, PR Finalizer, API E2E, UI smoke, and post-merge strict release gate passed. |
| `NC-E0-04` | `completed` | platform | Repo hygiene and generated artifact cleanup. | PR #80 merged at `6ae17d68db4a86875b6049ddfccaedea82e15183`; generated artifacts are untracked/ignored; active Firebase source/config templates are removed or fail deterministic hygiene checks; docs-only gates use a deterministic lightweight path; model critique debate is available when warranted. |
| `NC-E0-05` | `completed` | architecture + qa | Module-boundary enforcement. | PR #82 merged at `505f8aae60cc3dbc7e19ef7384e1df94457d3b4c`; CI fails on illegal cross-domain imports/re-exports; existing package boundaries and diff-scoped modularity guard are encoded in `pnpm architecture:boundaries`; required gates, Sonar, GitGuardian, PR Finalizer, API E2E, and UI smoke passed. |
| `NC-E0-06` | `completed` | ops | Disaster recovery baseline. | PR #84 merged at `d20bb12fd791f77af2f2d3b9bdfffe0e6d613811`; DR runbook records RPO/RTO, backup assumptions, restore workflow, evidence redaction rules, and restore-drill evidence requirements; required checks, Sonar, GitGuardian, PR Finalizer, API E2E, and UI smoke passed. |
| `NC-E1-01` | `completed` | architecture | Tenant model decision. | ADR-001 accepted organization plus branch/facility/location from v1; marketplace demand is tenant/facility scoped; nurse supply is platform-level only for non-PHI routing identity; nurse eligibility/credentialing/consent/assignment/audit context is tenant/facility/jurisdiction scoped; jurisdiction is compliance/operating scope, not tenant boundary; debate evidence recorded in `docs/reviews/nc-e1-01-tenant-model-debate.md`. |
| `NC-E1-02` | `completed` | platform + database | RLS platform mechanism. | PR #87 merged at `14c522558b630eb1ff3a2760dd27cac858ea0a8c`; tenant context wrapper, fail-closed tenant assertion, RLS connection-role assertion, focused database unit/DB tests, runbook, Sonar coverage mapping, required CI/Sonar/GitGuardian/PR Finalizer/API/UI gates, and local verify-slice evidence passed. |
| `NC-E1-03` | `completed` | platform + database | Default tenant backfill plan. | PR #89 merged at `15a6c9ebe688a6174a1e5620e33ffd986f90e04d`; `docs/runbooks/default-tenant-backfill-plan.md` defines expand/contract sequencing, default org/facility/jurisdiction bootstrap gates, data audit and PHI classification gates, out-of-band DB access evidence, pooler/callsite constraints, pause criteria, rollback, and model-review disposition before schema work. |
| `NC-E1-04` | `completed` | platform + database | Tenant isolation abuse tests. | PR #91 merged at `81035fad9d1fea3e17c0d43731d8ab9fdcf31901`; versioned tenant-isolation contract, readiness/guard/enforce harness modes, focused script tests, pooled-connection assertion reference, runbook, model-review disposition, verify-slice static/required gates, CI, Sonar, GitGuardian, PR Finalizer, API E2E, and UI smoke passed. |
| `NC-E2-01` | `ready` | identity + platform | Move current-user resolution into one platform identity boundary. | All role checks resolve through one function; bypass tests fail on alternate paths. |

## Next Slice

```text
NC-E2-01 / codex/platform-identity
```

Rationale:

- PR #91 completed `NC-E1-04 / tenant-isolation-tests` at `81035fad9d1fea3e17c0d43731d8ab9fdcf31901`.
- The repo now has the RLS platform mechanism, reviewed default-tenant expand/contract plan, and a tenant-isolation abuse-test harness that can move from readiness to guard to enforce as tenant-owned schema/RLS lands.
- `NC-E2-01 / platform-identity` is the next smallest safe step before tenant memberships and tenant/resource-aware authorization become authoritative.

## Recent Closeout Evidence

| Slice | PR | Merge Commit | Gate Summary |
|---|---|---|---|
| `NC-E0-01 / phase-0-identity-link` | `https://github.com/arbenl/nurseconnect-v3/pull/73` | `d636a890288955c0b5a5767c05956310d4a89bfb` | `PR Finalizer`, Sonar, GitGuardian, unit, DB, E2E API, and UI smoke gates passed. |
| `NC-E0-02 / production-email-verification` | `https://github.com/arbenl/nurseconnect-v3/pull/75` | `f534fd797378484820d42d612dcc94cbbdf48a33` | Production email verification rollout controls, runbook, required gates, Sonar, GitGuardian, PR Finalizer, E2E API, and UI smoke passed; post-merge main CI harness regression fixed by PR #76 at `308d4d255f5da976480d591825d60b23953b7a34`. |
| `NC-E0-03 / env-secret-checks` | `https://github.com/arbenl/nurseconnect-v3/pull/78` | `ec3a0f7845b73235aaf3200528728beea873c754` | Env validation, secret-handling documentation, CI, Sonar Quality Gate, Sonar PR Summary, Sonar Coverage, GitGuardian, PR Finalizer, API E2E, UI smoke, and post-merge strict release gate passed. |
| `NC-E0-04 / repo-hygiene` | `https://github.com/arbenl/nurseconnect-v3/pull/80` | `6ae17d68db4a86875b6049ddfccaedea82e15183` | Repo hygiene, generated artifact cleanup, active Firebase source/config cleanup, docs-only gate calibration, model critique debate tooling, CI, Sonar Quality Gate, Sonar PR Summary, Sonar Coverage, GitGuardian, PR Finalizer, API E2E, and UI smoke passed. |
| `NC-E0-05 / module-boundary-guard` | `https://github.com/arbenl/nurseconnect-v3/pull/82` | `505f8aae60cc3dbc7e19ef7384e1df94457d3b4c` | Module-boundary guard, cross-domain import/re-export enforcement, diff-scoped modularity guard, CI, Sonar Quality Gate, Sonar PR Summary, Sonar Coverage, GitGuardian, PR Finalizer, API E2E, UI smoke, and local required release gate passed. |
| `NC-E0-06 / dr-baseline` | `https://github.com/arbenl/nurseconnect-v3/pull/84` | `d20bb12fd791f77af2f2d3b9bdfffe0e6d613811` | Disaster recovery runbook, RPO/RTO targets, backup/PITR assumptions, PHI-safe restore-drill evidence template, launch-readiness DR links, CI, Sonar Quality Gate, Sonar PR Summary, Sonar Coverage, GitGuardian, PR Finalizer, API E2E, and UI smoke passed. |
| `NC-E1-01 / tenant-model-decision` | `https://github.com/arbenl/nurseconnect-v3/pull/86` | `bb801d748c797ac94489df3a52de327ffdbdb310` | ADR-001 Decision B, tenant/facility/jurisdiction classification, marketplace nurse supply boundary, model debate evidence, CI, Sonar Quality Gate, Sonar PR Summary, Sonar Coverage, GitGuardian, PR Finalizer, API E2E, and UI smoke passed. |
| `NC-E1-02 / rls-platform-mechanism` | `https://github.com/arbenl/nurseconnect-v3/pull/87` | `14c522558b630eb1ff3a2760dd27cac858ea0a8c` | Tenant context wrapper, tenant-context assertion, RLS role assertion, database unit/DB tests, RLS runbook, Sonar coverage mapping, verify-slice static/required gates, CI, Sonar Quality Gate, Sonar PR Summary, GitGuardian, PR Finalizer, API E2E, and UI smoke passed. |
| `NC-E1-03 / default-tenant-backfill-plan` | `https://github.com/arbenl/nurseconnect-v3/pull/89` | `15a6c9ebe688a6174a1e5620e33ffd986f90e04d` | Default tenant backfill runbook, expand/contract sequence, data-audit and PHI-classification gates, model-review disposition, local verify-slice static/required gates, CI, Sonar Quality Gate, Sonar PR Summary, Sonar Coverage, GitGuardian, PR Finalizer, API E2E, and UI smoke passed. |
| `NC-E1-04 / tenant-isolation-tests` | `https://github.com/arbenl/nurseconnect-v3/pull/91` | `81035fad9d1fea3e17c0d43731d8ab9fdcf31901` | Versioned tenant-isolation contract, readiness/guard/enforce harness modes, focused script tests, pooled-connection assertion reference, runbook, model-review disposition, local verify-slice static/required gates, CI, Sonar Quality Gate, Sonar PR Summary, Sonar Coverage, GitGuardian, PR Finalizer, API E2E, and UI smoke passed. |

## Status Rules

- `planned`: accepted work, not ready to start.
- `ready`: next valid slice if prerequisites are met.
- `in_progress`: active local or branch work.
- `review`: implemented, awaiting reviewer/gate/PR outcome.
- `completed`: merged or otherwise closed with evidence.
- `blocked`: cannot progress without an explicit decision or external dependency.
