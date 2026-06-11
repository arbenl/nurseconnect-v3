---
name: nurseconnect-execution-runner
description: Standard Operating Procedure for any AI agent executing a slice of the NurseConnect Phase C Enterprise Upgrade (ENTERPRISE_UPGRADE_TRACKER.md or current-tracker.md). Use whenever asked to implement, execute, or close out a tracker slice (NC-EG, NC-E2, NC-TB, NC-E3, NC-CQ, NC-E5), or to open a PR in nurseconnect-v3. Enforces the Four Mandates, MCP-first investigation, slice-manager lifecycle mediation, and the fail-closed verify-slice gate contract.
---

# NurseConnect Execution Runner (Phase C SOP)

You are executing one slice of the NurseConnect Enterprise Upgrade. This SOP is
binding. If any step fails, STOP — the slice stays `in_progress`/`blocked`.
Never mark a slice, task, or tracker row complete without Step 9 evidence.

## Investigation discipline (MCP-first — mandatory)

- Investigate with repo-scoped MCP tools FIRST: `nurseconnect_qa` (alias
  `nurse_qa`), project map, targeted code search, and scoped file reads.
- NEVER dump bulk content into context: no bare `cat` of whole files, no
  recursive `grep`/`grep -r`, no `ls -R`, no unscoped tree dumps. When MCP
  lacks the capability, use targeted `rg -n -A 3 -B 3` with explicit paths and
  cap any single read at 250 lines (AGENTS.md fast-tools policy).
- If an MCP tool is blocked or errors, record the exact blocker/error in your
  notes BEFORE any shell fallback. Wasting context on raw dumps is an SOP
  violation: it burns quota and degrades execution quality.

## Lifecycle mediation (slice-manager doctrine)

- **Once `NC-EG-05 / slice-manager` merges:** `slice-manager start <id>`,
  `slice-manager finish`, and `slice-manager closeout` are the ONLY permitted
  mechanisms for slice branch creation, tracker status changes, lifecycle PR
  opening, and closeout recording. Manual `git checkout -b`, manual tracker
  status edits, and manual `gh pr create` for slice lifecycle are
  constitutional violations once the tool exists.
- **Until NC-EG-05 merges:** perform Steps 2 and 9 manually and exactly as
  written. Interim hard rules either way: never auto-merge; never `git add .`
  (stage files explicitly); never write `completed` before merge evidence
  exists; status vocabulary is only `planned/ready/in_progress/review/
  completed/blocked`; branches are only `codex/<slice-name>`.
- No tool, script, or agent may execute verification commands sourced from
  document frontmatter or any non-allowlisted location.

## Step 0 — Constitution check (every session, before touching code)

1. Read `AGENTS.md` (Four Mandates) and the authority chain:
   `docs/plans/current-program.md` → `docs/plans/current-tracker.md` →
   `docs/plans/ENTERPRISE_UPGRADE_TRACKER.md`.
2. Confirm the requested slice is the promoted next slice, or all its
   prerequisites in the tracker dependency graph are `completed`. If not,
   STOP and report the conflict instead of executing.
3. Start from clean, synced `main` (`git status` clean, `git pull` fresh).

## Step 1 — Design before branch

1. Draft the slice design (scope, files, falsifiable exit criteria copied from
   the tracker row, threat surface) in `docs/plans/<slice-id>-design.md`.
2. STOP and request design review from Fable (the Chief Senior Engineer).
   You must receive explicit permission from Fable, and apply accepted findings,
   BEFORE branching.

## Step 2 — Branch (via slice-manager once it lands)

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

Then, STOP and present the slice to Fable (the Chief Senior Engineer). You must
receive explicit permission from Fable before proceeding to open the PR.
No silent dismissals.

## Step 8 — Required gates

```bash
pnpm verify-slice -- --run-root <run_root> --required-gates
```

This must pass — including the ent-gate stage once NC-EG-01 is merged — BEFORE
opening a PR. A PR opened without this evidence violates Mandate 4.

## Step 9 — PR, merge, closeout (via slice-manager once it lands)

1. Open ONE PR; body includes: slice ID, verify-slice `run_root` + evidence
   paths, gate manifest (+ sha), threat-model path (if `ent-tm: required`), and
   the tracker's falsifiable exit criteria with proof for each.
2. Fix CI, Sonar, GitGuardian, Copilot, and reviewer findings. Merge only when
   ALL required checks including PR Finalizer are green. Never self-merge with
   `--auto` to skip the review loop.
3. After merge only: sync `main`, delete local+remote branch, record closeout
   (PR #, merge commit, gate summary) in `current-tracker.md` AND
   `ENTERPRISE_UPGRADE_TRACKER.md`, set the slice `completed`, promote the next
   slice from clean `main`.

## Completion rule (absolute)

A slice is complete ONLY when: required-gates evidence exists for the final
HEAD, the PR is merged green, closeout is recorded in both trackers, and the
next slice is promoted. If any of these is missing, report status honestly as
`in_progress` or `blocked` with the exact failing step and error.

## Docs-only slices

May use the docs/static hygiene verify-slice path; the PR body must state the
reduced review scope explicitly. Never skip verify-slice silently — including
for tracker-promotion commits.
