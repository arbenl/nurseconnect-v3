# NurseConnect Slice Workflow

This runbook defines the required workflow for NurseConnect slices.

## Standard Flow

1. Start from clean, synced `main`.
2. Define the slice.
3. Create a fresh branch: `codex/<slice-name>`.
4. Implement only that slice.
5. Run focused deterministic local checks while developing.
6. Run `pnpm verify-slice` and keep the printed `run_root`.
7. Run `pnpm verify-slice -- --run-root <run_root> --static`.
8. Run the pre-PR reviewer pool from the generated reviewer plan.
9. Fix every `MUST_FIX` finding, or document a technical rejection before PR.
10. Run `pnpm verify-slice -- --run-root <run_root> --required-gates`.
11. Open a PR.
12. Let CI, Sonar if present, Copilot, and human review run.
13. Fix PR findings until all review threads are resolved.
14. Merge only when all required checks are green, including PR Finalizer.
15. Sync local `main`.
16. Update Notion when the slice changes program, roadmap, launch, or milestone state.
17. Delete the local and remote branch.
18. Start the next slice from fresh `main`.

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
