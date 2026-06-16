# Slice Playbook Scorecard

This scorecard ports the proven Interdomestik slice discipline to
NurseConnect without importing Interdomestik business semantics.

## Before Editing

Every slice thread must report:

- active slice and why it is next from `current-program.md` and
  `current-tracker.md`
- risk tier: Tier 0 docs, Tier 1 tooling, Tier 2 workflow/API/UI, or Tier 3
  auth, tenancy, schema, RLS, PHI, audit, outbox, payment, or notifications
- branch/worktree readiness from clean synced `main`, or an explicit continuing
  branch reason
- protected or high-risk paths touched, including auth, tenancy, schema/RLS,
  PHI, notification delivery, payments, workflows, and program docs
- non-goals that prevent accidental adjacent work
- MCP status, especially `nurseconnect_qa` availability or blocker

## During Implementation

- Implement the smallest slice that proves the active tracker goal.
- Keep focused proof close to the changed behavior before broad gates.
- Use `verify-slice` as the run-root source of truth for static, reviewer, and
  required-gate evidence.
- Do not grow oversized files; extract the touched logical path instead.
- Keep PHI, secrets, production data, and clinical details out of reviewer
  packets and generated evidence.

## Reviewer Routes

- Default strict external model reviewers are `sonnet46,gemini`.
- Codex senior review is recorded separately when callable.
- A route blocked by auth, model id, quota, rate limit, timeout, or no output is
  not approval.
- Do not retry a quota-limited or silent route repeatedly in the same slice.
  Record `blockerReason`, then continue with available external reviewers and
  deterministic gates.
- Tier 2, Tier 3, AI-affected, or protected-surface slices need debate evidence
  unless all model routes are blocked and that blocked disposition is recorded.

## Gate De-Duplication

Avoid rerunning subcommands already covered by `verify-slice --static` or
`verify-slice --required-gates` unless a failure needs focused diagnosis.

Keep these as mandatory final evidence:

- focused tests for touched behavior
- `pnpm verify-slice`
- `pnpm verify-slice -- --run-root <run_root> --static`
- reviewer pool and model-review disposition
- `pnpm verify-slice -- --run-root <run_root> --required-gates`
- remote CI, Sonar, GitGuardian, PR Finalizer, and review threads green
- server-side branch protection or ruleset state verified by GitHub API when
  claiming protected `main` merge readiness

If a local parity gate fails from resources after mandatory gates pass, record
the exact blocker instead of mixing it with product regressions.

## Closeout

A slice is not complete until the PR is merged green, local `main` is synced and
clean, branches are deleted, closeout evidence is recorded, and the next slice
is promoted only from fresh `main`.

## Measurement Notes

Each slice completion report should include blockers detected, duplicate gates
skipped or rerun, reviewer route outcomes, CI reruns, manual interventions, and
whether the playbook improved or slowed delivery.
