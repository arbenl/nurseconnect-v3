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
14. Monitor CI, Sonar, Copilot, Vercel if present, PR Finalizer, and review threads.
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

Use configured model reviewers as advisory reviewers, not authority. Prefer this order when callable in the active runtime:

- Claude for architecture, coupling, feasibility, and test-plan critique
- Gemini Pro for product, workflow, UX, accessibility, and copy critique
- Copilot Pro+ for implementation-risk and PR-review style critique

Use `pnpm model-review -- --packet <design-packet.md> --run-root <run_root>` to write review receipts under `<run_root>/reviews/`. If a reviewer is unavailable, blocked, unauthenticated, or quota-limited, record the blocker and either use the strongest available fallback or ask the user for the external review result. Accepted findings must update the design before branch creation. Rejected findings need a short technical rationale.

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
pnpm env:check
git diff --check
git diff --cached --check
git diff --check <base>...HEAD
temporary-index diff check for untracked files
pnpm -w type-check
pnpm lint
pnpm --filter web build
pnpm launch:readiness
```

`--required-gates` runs:

```bash
pnpm gate:release
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
tmp/multi-agent/verify-slice/<run-id>/evidence/gates/
```

The PR body should also state:

- selected reviewers
- `MUST_FIX` count
- whether every `MUST_FIX` was fixed or technically rejected
- local static gate result
- local required gate result

## Closeout And Promotion

After merge:

1. Sync local `main` and verify it is clean.
2. Confirm the merged PR checks are green.
3. Delete the local and remote feature branch.
4. Update repo tracker state or external tracker state when authorized.
5. Record closeout evidence: PR URL, merge commit, verify-slice run root, reviewer disposition, and remaining risks.
6. Promote the next tracker slice only after `main` is synced and clean.
