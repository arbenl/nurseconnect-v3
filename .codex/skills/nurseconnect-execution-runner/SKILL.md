---
name: nurseconnect-execution-runner
description: Standard Operating Procedure for any AI agent executing a slice of the NurseConnect Phase C Enterprise Upgrade (ENTERPRISE_UPGRADE_TRACKER.md or current-tracker.md). Use whenever asked to implement, execute, or close out a tracker slice (NC-EG, NC-E2, NC-TB, NC-E3, NC-CQ, NC-E5), or to open a PR in nurseconnect-v3. Enforces the Four Mandates, MCP-first investigation, ADR-005 three-plane lifecycle mediation, and the fail-closed verify-slice gate contract.
---

# NurseConnect Execution Runner (Phase C SOP)

You are executing one slice of the NurseConnect Enterprise Upgrade. This SOP is
binding. If any step fails, STOP — the slice stays `in_progress`/`blocked`.
Never mark a slice, task, or tracker row complete without Step 9 evidence.

## Investigation discipline (MCP-first — mandatory)

- Investigate with repo-scoped MCP tools FIRST: `nurseconnect_qa` (alias
  `nurse_qa`), project map, targeted code search, and scoped file reads.
- NEVER dump bulk content into context: no bare `cat` of whole files, no
  recursive `grep`/`grep -r`, no `ls -R`, no unscoped tree dumps. If MCP lacks
  a capability, use targeted `rg -n -A 3 -B 3` and cap reads at 250 lines.
- If MCP is blocked, record the exact blocker/error before shell fallback.

## Lifecycle mediation (ADR-005 three-plane doctrine)

- **Once `NC-EG-05 / lifecycle-three-planes` merges:** slice promotion runs
  through the thin, authority-free `start <id>` client (plane 3 — validate
  promotion, create branch, open promotion PR); tracker `completed`/closeout
  rows are written ONLY by the server-side plane-1 bot on merge events. Agents
  NEVER write tracker statuses or closeout after that point — manual tracker
  status edits become constitutional violations. Enforcement lives in the
  required PR Finalizer check (plane 2), never in agent-side tooling.
- **Until NC-EG-05 merges:** perform Steps 2 and 9 manually and exactly as
  written. Interim hard rules either way: never auto-merge; never `git add .`
  (stage files explicitly); never write `completed` before merge evidence
  exists; status vocabulary is only `planned/ready/in_progress/review/
  completed/blocked`; branches are only `codex/<slice-name>`.
- No tool, script, or agent may execute verification commands sourced from
  document frontmatter or any non-allowlisted location.

## Step 0 — Constitution check (every session, before touching code)

1. Read `AGENTS.md` and the authority chain: `docs/plans/current-program.md` →
   `docs/plans/current-tracker.md` → `docs/plans/ENTERPRISE_UPGRADE_TRACKER.md`.
2. Confirm the requested slice is promoted next, or all dependencies are
   `completed`. If not, STOP and report the conflict instead of executing.
3. Start from clean, synced `main` (`git status` clean, `git pull` fresh).

## Step 1 — Design before branch

1. Draft the slice design (scope, files, falsifiable exit criteria, threat
   surface) in `docs/plans/<slice-id>-<slice-name>-design.md`.
2. STOP for configured design review. Apply accepted findings and record the
   route; Fable is used only for explicit escalation or protected disagreement.

## Step 2 — Branch (via the plane-3 `start` client once NC-EG-05 lands)

Create exactly one branch: `codex/<slice-name>`. Implement only the promoted
slice. Out-of-scope findings go in a note for a future slice, not in the diff.

## Step 3 — Gate manifest (fail-closed)

Create/update `slice-gates.yaml` (per NC-EG-01): declare `ent-tm`, `ent-dlv`,
`ent-perf` each as `required` or `n/a` with written justification. PHI-, auth-,
tenancy-, schema-, or money-touching diffs may never declare `ent-tm: n/a`;
schema-touching diffs may never declare `ent-dlv: n/a`. (Before NC-EG-01
merges, still write the manifest — it becomes PR evidence.)

## Step 4 — Implement under the Four Mandates

- **Mandate 1:** no bare-row mutations. State changes co-commit their event/
  audit row; after NC-E3-02, append to the outbox. NEVER add a new inline side
  effect inside `db.transaction`.
- **Mandate 2:** no cross-domain SQL joins. Read models or published contracts
  only. Do not extend the quarantined joins in `domain-referral`,
  `domain-visit`, `domain-nurse`.
- **Mandate 3:** no raw string states. Status/state writes go through the
  owning domain's transition constructors (`AuthorizedTransition`,
  `MedicalEvidence` once landed; branded `OrganizationId` now).
- **Mandate 4 hygiene:** new files ≤ 150 lines; never grow a >150-line legacy
  file; no PHI in logs, messages, or test fixtures; no Firebase.

## Step 5 — Focused checks while developing

`pnpm -w type-check`, `pnpm lint`, focused package tests, plus
`pnpm architecture:boundaries` and `pnpm modularity:guard` before any commit.

## Step 6 — verify-slice (MANDATORY — the core of this SOP)

```bash
pnpm verify-slice            # KEEP the printed run_root
pnpm verify-slice -- --run-root <run_root> --static
```

If either fails: fix and re-run. Do not proceed on red. Do not edit gate
scripts, thresholds, or the manifest to force green — that is a constitutional
violation; report it instead.

## Step 7 — Reviewer pool

Run the pre-PR reviewer pool from
`tmp/multi-agent/verify-slice/<run-id>/reviewer-plan.md`. Fix every `MUST_FIX`
or record a written technical rejection.

Then run `pnpm codex:senior-review -- --run-root <run_root>` and record
`reviews/codex-senior-review.{json,md}`. Supabase/schema/RLS/auth-provider
slices use `pnpm codex:senior-review:supabase -- --run-root <run_root>`.
Fable is escalation evidence only; record quota/auth/no-output blockers once
and do not count blocked routes as approval.

## Step 8 — Required gates

```bash
pnpm verify-slice -- --run-root <run_root> --required-gates
```

This must pass — including the ent-gate stage once NC-EG-01 is merged — BEFORE
opening a PR. A PR opened without this evidence violates Mandate 4.

## Step 9 — PR, merge, closeout (plane-1 bot owns closeout once NC-EG-05 lands)

1. Open ONE PR with slice ID, final `run_root`, evidence paths, gate manifest
   (+ sha), threat-model path if required, and proof for each exit criterion.
2. Monitor the PR until terminal: use `gh pr checks --watch`, inspect failing
   Actions logs, and watch Sentry/Sonar/GitGuardian/reviewer threads.
3. Stop broad reruns and merge attempts when Sonar, Sentry, Copilot/reviewer,
   or PR Finalizer has actionable feedback; fix it first in the same branch.
   Use `STRICT_GUARD_SKIP=1` only to publish a proven review-fix after focused
   proof plus required local gates; the pushed head still needs all green.
4. When all required checks are green, PR Finalizer passes, and review threads
   are resolved, merge the PR. Never self-merge with `--auto` to skip review.
5. After merge only: sync `main`, verify it is clean, delete the local branch,
   delete the remote branch, and prune stale refs.
6. Record closeout (PR #, merge commit, gate summary, `run_root`) in
   `current-tracker.md` and `ENTERPRISE_UPGRADE_TRACKER.md`; set the slice
   `completed`, promote the next slice, and commit/push that closeout if
   NC-EG-05 plane-1 automation has not taken ownership yet.
7. Resume from Step 0 for the promoted next slice only after clean synced
   `main`; if closeout or promotion fails, STOP as `blocked`.

## Completion rule (absolute)

A slice is complete ONLY when: required-gates evidence exists for the final
HEAD, the PR is merged green, closeout is recorded in both trackers, and the
next slice is promoted. If any of these is missing, report status honestly as
`in_progress` or `blocked` with the exact failing step and error.

## Docs-only slices

May use the docs/static hygiene verify-slice path; the PR body must state the
reduced review scope explicitly. Never skip verify-slice silently — including
for tracker-promotion commits.
