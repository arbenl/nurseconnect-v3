# M9: Roadmap Reconciliation and Next-Slice Program Plan

Date: 2026-04-24
Status: Approved for documentation slice
Scope: Program, roadmap, launch definition, tracker, and next-slice sequencing

## Purpose

M9 reconciles the NurseConnect program sources after M8 so the next branch starts
from a current product truth instead of stale roadmap fragments.

This is a planning and documentation slice. It does not change application
runtime behavior.

## Problem

The launch tracker and implementation history moved faster than the older
roadmap pages. After M8, the project has a top-level program page, blueprint,
master roadmap, v1.0.0 definition, tracker, and task database, but they do not
all say the same thing.

The most important inconsistency is M1:

- the launch runbook correctly records Referral Partner MVP as done through PR
  #48 and PR #49
- the Notion tracker still listed M1 as in progress
- the older roadmap still described M2 through M4 as immediate priorities even
  though M2 through M8 are already merged
- the Program page named a canonical repo blueprint file that was absent from
  the repo

That makes the "what is next?" decision ambiguous.

## Source Of Truth After M8

The canonical hierarchy is:

1. Program page: top-level product and repo state.
2. v1.0.0 Definition: launch scope and capability definition.
3. v1.0.0 Tracker: milestone state and next-slice sequencing.
4. Tasks DB: task-level execution tracking.
5. Blueprint and Master Roadmap: durable strategic direction, kept current by
   reconciliation slices when milestone execution changes the state.

The repo-side canonical docs are:

- `docs/superpowers/specs/2026-04-13-nurseconnect-blueprint-design.md`
- `docs/superpowers/specs/2026-04-17-referral-partner-mvp-design.md`
- `docs/superpowers/plans/2026-04-17-referral-partner-mvp.md`
- `docs/runbooks/launch_readiness_review.md`
- `docs/superpowers/specs/2026-04-21-production-monitoring-alerting-design.md`

## Reconciled Milestone State

| Milestone | State After M8 | Evidence |
| --- | --- | --- |
| M0 Architecture spine | Done | Enterprise migration through Step 8 |
| M1 Referral Partner MVP | Done | PR #48 planning, PR #49 implementation |
| M2 Triage and Exception Model | Done | PR #50 |
| M3 Private-Pay and Payout Traceability | Done | PR #51 |
| M4 Service-Area Controls | Done | PR #52 |
| M5 Launch Readiness Review | Done | PR #53 |
| M6 Automated Launch Rehearsal | Done | PR #54 |
| M7 Full Milestone Browser Rehearsal | Done | PR #55 |
| M8 Production Monitoring and Alerting | Done | PR #56 |
| M9 Roadmap Reconciliation | This slice | Current branch |

## Current Direction

NurseConnect is still heading toward a controlled v1.0.0 launch of a managed,
referral-led in-home nursing dispatch product:

- one launch city before expansion
- verified nurse supply only
- referral-led demand with direct patient demand as secondary
- scheduled-first low-acuity visits
- same-day simple visits only when local verified supply exists
- admin-controlled operations, triage, service areas, payment traceability, and
  launch monitoring

M8 closed the production visibility gap. The next work should either reduce
launch operational risk or improve the first commercial launch loop.

## Recommended Next Three Slices

### M10: First-Hour Production Synthetic Monitoring

Purpose: turn the M8 health and ops endpoints into a repeatable first-hour
monitoring workflow.

Expected scope:

- add `pnpm launch:monitor` for read-only polling of `/api/health`
- optionally poll `/api/admin/ops/status` when admin credentials/session are
  available
- emit human and JSON output
- fail nonzero on launch-blocking thresholds
- update launch runbooks with exact usage

Why next: M8 created monitoring signals. M10 makes them operational during the
highest-risk launch window.

### M11: Auth and Session Degradation Monitoring

Purpose: detect auth/session failure modes that M8 explicitly deferred.

Expected scope:

- add a narrow auth health/synthetic check that validates login/session/admin
  reachability without broad user telemetry
- define failure thresholds and runbook response
- keep PHI and secrets out of logs and alert payloads

Why after M10: it extends monitoring into the highest-risk platform dependency
without blocking the first launch monitor.

### M12: Launch Operator Console Hardening

Purpose: reduce manual operator work during the first controlled launch.

Expected scope:

- improve admin-facing visibility around the exact M8 ops status fields
- add clear stale/enroute/payment-gap callouts if not already visible enough
- keep it as an operator workflow slice, not a public status page

Why third: it should be shaped by what M10/M11 reveal about actual launch
monitoring needs.

## Explicit Non-Goals

- No runtime product changes in M9.
- No new database migrations.
- No monitoring implementation in M9; M10 owns that.
- No public status page.
- No expansion beyond the v1.0.0 launch thesis.

## Acceptance Criteria

- Repo docs identify M1 as done with PR #48 and PR #49 evidence.
- The canonical blueprint file exists in the repo.
- Repo launch evidence includes M5 through M8 as completed.
- Notion Program, Blueprint/Roadmap/Definition/Tracker are reconciled after M8.
- The next three slices are named and ordered.
- Local branch remains docs-only and safe to merge after normal PR checks.
