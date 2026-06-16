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
- Codex senior review uses `pnpm codex:senior-review` and records a structured receipt.
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

## GitHub Feedback Sequencing

Once a PR is open, stop broad gate reruns and merge attempts when GitHub shows
Sonar failures, Copilot/Sentry review comments, unresolved review threads, or
PR Finalizer evidence failures. Inspect and fix that feedback first, then rerun
the remote required checks.

For review-thread sequencing, do not weaken merge readiness. If a bot thread is
already fixed locally but blocks publishing the amended commit, a narrow
`STRICT_GUARD_SKIP=1 git push --force-with-lease ...` is allowed only after:

- focused proof for the fix passed
- `verify-slice --required-gates` or the equivalent required local gate passed
  on the amended worktree
- unresolved threads are known to be addressed, not ignored
- the PR is still held until CI, Sonar, GitGuardian, review threads, and PR
  Finalizer are green on the pushed head

Do not use the bypass for product failures, skipped evidence, red CI, missing
Sonar, or unresolved findings that have not been technically addressed.

## Closeout

A slice is not complete until the PR is merged green, local `main` is synced and
clean, branches are deleted, closeout evidence is recorded, and the next slice
is promoted only from fresh `main`.

## Current Maturity

Measured after PR #105 and PR #106:

| Dimension | Score | Evidence / Remaining Gap |
|---|---:|---|
| Governance/playbook design | 9.0 | Authority chain, tracker promotion, branch protection audit, and finalizer evidence are encoded; lifecycle automation is still manual. |
| Parser/finalizer robustness | 9.1 | PR evidence parser handles semantic labels and branch-protection drift; Finalizer blocked missing evidence correctly. |
| Reviewer route handling | 8.7 | Sonnet/Gemini/Codex senior routes and blocked-route evidence exist; review-fix publish sequencing still needs a first-class command. |
| CI/release gate efficiency | 8.6 | Focused proof precedes broad gates and strict release evidence is real; pre-push can still duplicate expensive CI work. |
| Future-thread skill enforcement | 8.8 | Skill and scorecard encode stop-on-feedback and gate authority; future compliance still depends on agents reading them. |
| Enterprise readiness | 8.6 | Gates, auditability, and protected merge policy improved; clinical/PHI, outbox, CQRS, and RLS hardening remain ahead. |
| Overall maturity | 8.8 | Technically stronger than narrative maturity, but not 9+ until review-fix publish and tracker closeout are automated. |

## Measurement Notes

Each slice completion report should include blockers detected, duplicate gates
skipped or rerun, reviewer route outcomes, CI reruns, manual interventions, and
whether the playbook improved or slowed delivery.
