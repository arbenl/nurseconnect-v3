# NurseConnect Slice Workflow

This runbook defines the required workflow for NurseConnect slices.

## Standard Flow

1. Start from clean, synced `main`.
2. Draft the slice design from canonical program and tracker truth.
3. Send the design to configured external reviewers when available.
4. Apply accepted design-review feedback before implementation.
5. Create a fresh branch: `codex/<slice-name>`.
6. Implement only that slice.
7. Run focused deterministic local checks while developing.
8. Run `pnpm verify-slice` and keep the printed `run_root`.
9. Run `pnpm verify-slice -- --run-root <run_root> --static`.
10. Run the pre-PR reviewer pool from the generated reviewer plan.
11. Fix every `MUST_FIX` finding, or document a technical rejection before PR.
12. Run `pnpm verify-slice -- --run-root <run_root> --required-gates`.
13. Open one PR with evidence.
14. Monitor CI, Sonar, review-bot findings, Vercel if present, PR Finalizer, and review threads.
15. Fix PR findings until all required checks and required reviews are green.
16. Merge only when all required checks are green, including PR Finalizer.
17. Sync local `main`.
18. Update Notion or external trackers when the slice changes program state.
19. Delete the local and remote branch.
20. Record closeout evidence and promote the next slice only from fresh `main`.

## Design Gate Before Implementation

Do not start implementation until the slice design has been reviewed or explicitly waived by the user. The design packet should include:

- tracker ID, branch name, and risk tier
- why this slice is next
- exact scope and explicit non-scope
- expected files or boundaries
- data, auth, tenant, PHI, and operational risks
- rollback or mitigation plan
- tests and verification commands
- acceptance criteria that can fail deterministically

Use configured model reviewers as advisory reviewers, not authority. Default strict external route set is `sonnet46,gemini`; local Codex senior review is recorded separately when callable. Do not count Copilot as local reviewer approval.

Before relying on external reviewer routes, run `pnpm model-review -- --preflight --run-root <run_root> --reviewers sonnet46,gemini`, then `pnpm model-review -- --access-check --run-root <run_root> --reviewers sonnet46,gemini`. Keep `<run_root>/reviews/model-review-preflight.*` and `model-review-access.*`; blocked model ids, auth, quota, or provider failures are not approval and must be recorded as blocked external-review evidence.

If an installed route uses an unavailable model id, override only that route with `CLAUDE_48_REVIEW_MODEL`, `CLAUDE_47_REVIEW_MODEL`, `CLAUDE_SONNET_46_REVIEW_MODEL`, `GEMINI_REVIEW_MODEL`, or `COPILOT_REVIEW_MODEL`, then re-run access check.

Use `pnpm model-review -- --packet <design-packet.md> --run-root <run_root> --reviewers sonnet46,gemini --debate` for routine multi-model critique. Escalate only for high-trust surfaces or unresolved disagreement. It writes receipts plus `reviews/debate.*`; accepted findings update the design, and rejected findings need technical rationale.

Default debate triggers: Tier 2/Tier 3 implementation, AI-affected slices, broad Tier 1 tooling/gate changes, reviewer disagreement, or explicit user request. If external routes are blocked, do not fabricate approval; continue with deterministic gates and record that the model debate was skipped because routes were blocked.

## Verify Slice

`pnpm verify-slice` is a NurseConnect-native pre-PR workflow helper.

Default behavior writes a diff-scoped reviewer plan and prompts under:

```text
tmp/multi-agent/verify-slice/<run-id>/
```

Useful commands:

```bash
pnpm verify-slice
pnpm verify-slice -- --run-root tmp/multi-agent/verify-slice/<run-id> --static
pnpm verify-slice -- --run-root tmp/multi-agent/verify-slice/<run-id> --required-gates
```

`--static` runs:

```bash
pnpm mcp:preflight
pnpm env:check
pnpm repo:hygiene
pnpm modularity:guard
git diff --check
git diff --cached --check
git diff --check <base>...HEAD
temporary-index diff check for untracked files
sentinel advisory
sentry advisory (strict unless `SENTRY_ADVISORY_MODE=advisory`)
```

For non-docs slices, `--static` also runs:

```bash
sonar advisory
pnpm -w type-check
pnpm lint
pnpm --filter web build
pnpm launch:readiness
```

For non-docs slices, `--required-gates` runs:

```bash
pnpm gate:release
```

For docs/tracker-only slices, `--required-gates` runs the docs/static hygiene path instead of the full release gate:

```bash
pnpm mcp:preflight
pnpm env:check
pnpm repo:hygiene
git diff --check
git diff --cached --check
git diff --check <base>...HEAD
```

## Reviewer Pool

`verify-slice` selects a reviewer set based on changed files.

Always selected:

- `security_reviewer`
- `architecture_reviewer`
- `qa_reviewer`
- `ops_reviewer`

Conditionally selected:

- `performance_reviewer` for backend, database, queue, dispatch, polling, or hot UI changes
- `contracts_reviewer` for APIs, contracts, database schema, scripts, workflows, package metadata, or environment contracts

Reviewer configuration lives in:

```text
config/reviewers/
```

Reusable reviewer prompts live in:

```text
prompts/reviewers/
```

Generated slice-specific prompts live in the run root.

## Finding Severity

- `MUST_FIX`: correctness, security, PHI/privacy, auth boundary, broken contract, or failing gate risk. Blocks PR unless explicitly rejected with technical reasoning.
- `SHOULD_FIX`: maintainability or coverage risk that should be handled before PR if practical.
- `NICE_TO_HAVE`: optional cleanup. Does not block PR.

## PR Evidence

Include the `verify-slice` run root in the PR body:

```text
tmp/multi-agent/verify-slice/<run-id>/reviewer-plan.md
tmp/multi-agent/verify-slice/<run-id>/reviews/subagent-handoff.md and reviews/subagent-results.md
tmp/multi-agent/verify-slice/<run-id>/reviews/model-review-preflight.md and reviews/model-review-access.md
tmp/multi-agent/verify-slice/<run-id>/evidence/nurseconnect-qa.md and evidence/model-review.md
tmp/multi-agent/verify-slice/<run-id>/evidence/gates/
```

The PR body should also state:

- tracker ID, selected reviewers, subagent results, and model route preflight result or docs-only/dry-run skip reason
- `MUST_FIX: <count> (none|all fixed|rejected:<reason>)`
- `pnpm modularity:guard -- --base <base_commit>` result
- local static and required gate results
- `pnpm slice:evidence -- --run-root <run_root>` result
- for Tier 2, Tier 3, AI-affected, or protected-surface PRs with passing model access: `pnpm slice:evidence -- --run-root <run_root> --require-reviewers "sonnet46,gemini" --require-model-preflight --require-model-access --require-model-review --require-subagent-results --require-debate --must-fix-disposition "<none|all fixed|rejected:reason>"`
- for blocked model access: cite `reviews/model-review-access.md`, state that external reviewers were blocked and not counted as approval, and keep deterministic local gates mandatory
- no `--allow-dry-run` as approval for Tier 2, Tier 3, AI-affected, or protected-surface PR evidence
- when the run root exists locally, `PR_FINALIZER_VERIFY_SLICE_RUN_ROOT=1 pnpm pr:finalizer`

The PR body must keep the `Evidence`, `Logs`, `Screenshots`, `Runbook`, and `Pilot guardrails` sections from `.github/PULL_REQUEST_TEMPLATE.md`; `PR Finalizer` parses them and fails missing slice evidence, model-review/debate evidence, or protected-surface guardrails.

## Merge Gate Artifacts

Repo-owned merge gate artifacts live in `.github/`:

- `.github/CODEOWNERS` names owner review for auth, schema, contract, workflow,
  reviewer, and canonical program paths.
- `.github/branch-protection.json` records the GitHub REST branch-protection
  payload for `main`, including required CI/Sonar/GitGuardian/PR Finalizer
  contexts and CODEOWNERS enforcement.

The JSON file is declarative until an authorized maintainer applies it with the
`apply_command` embedded in the file. Do not treat the file itself as proof that
GitHub server-side branch protection is active; verify with the GitHub API when
closeout requires it.

Authorized maintainers can apply the recorded policy after merge:

```bash
jq '.payload' .github/branch-protection.json \
  | gh api --method PUT repos/arbenl/nurseconnect-v3/branches/main/protection --input -
```

Then verify server-side state:

```bash
gh api repos/arbenl/nurseconnect-v3/branches/main/protection \
  --jq '{required_status_checks,required_pull_request_reviews,enforce_admins}'
```

Only run those commands for `arbenl/nurseconnect-v3` `main`, never for forks or
other repositories.

## Closeout And Promotion

After merge:

1. Sync local `main` and verify it is clean.
2. Confirm the merged PR checks are green.
3. Delete the local and remote feature branch.
4. Update repo tracker state or external tracker state when authorized.
5. Record closeout evidence: PR URL, merge commit, verify-slice run root, reviewer disposition, and remaining risks.
6. Promote the next tracker slice only after `main` is synced and clean.
