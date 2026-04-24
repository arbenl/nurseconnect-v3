# M9: Roadmap Reconciliation and Next-Slice Program Plan

> Documentation-only slice. No application runtime behavior should change.

## Goal

Reconcile the NurseConnect roadmap sources after M8 and define the next three
implementation slices so future work starts from a current program plan.

## Inputs

- Notion Program page
- Notion v1.0.0 Definition
- Notion v1.0.0 Tracker
- Notion Master Roadmap
- Notion Blueprint
- `docs/runbooks/launch_readiness_review.md`
- `docs/superpowers/specs/2026-04-17-referral-partner-mvp-design.md`
- `docs/v1.0.0-plan.md`

## Tasks

- [ ] Confirm clean synced `main`.
- [ ] Create `codex/roadmap-reconciliation-next-slice-plan`.
- [ ] Add M9 design spec with reconciled milestone state.
- [ ] Restore the missing canonical blueprint file referenced by the Program
      page.
- [ ] Update repo launch evidence to mark M1 and M5-M8 accurately.
- [ ] Mark local Referral Partner MVP spec as completed through PR #48/#49.
- [ ] Add a status note to the older v1.0.0 plan explaining that M0-M8 are now
      the current launch milestone sequence.
- [ ] Validate Markdown references and repo diff.
- [ ] Commit, push, and open PR.
- [ ] Sync Notion with PR URL, status, and next three slices.

## Reconciled Milestone State

| Milestone | State | Evidence |
| --- | --- | --- |
| M0 Architecture spine | Done | Enterprise migration through Step 8 |
| M1 Referral Partner MVP | Done | PR #48, PR #49 |
| M2 Triage and Exception Model | Done | PR #50 |
| M3 Private-Pay and Payout Traceability | Done | PR #51 |
| M4 Service-Area Controls | Done | PR #52 |
| M5 Launch Readiness Review | Done | PR #53 |
| M6 Automated Launch Rehearsal | Done | PR #54 |
| M7 Full Milestone Browser Rehearsal | Done | PR #55 |
| M8 Production Monitoring and Alerting | Done | PR #56 |
| M9 Roadmap Reconciliation | This slice | Current PR |

## Next Three Slices

This recommendation was executed through M12 and is superseded by
`docs/superpowers/specs/2026-04-24-program-roadmap-lock-design.md`, which locks
the post-M14 sequence before CRM or other product surfaces are implemented.

1. M10: First-Hour Production Synthetic Monitoring
2. M11: Auth and Session Degradation Monitoring
3. M12: Launch Operator Console Hardening

## Validation

This is a docs-only slice. Validation is:

```bash
git diff --check
rg -n "M1|M8|M9|M10|Referral Partner|Production Monitoring" docs
```

The normal PR workflow still applies: PR Finalizer, Copilot/Sonar feedback, all
required checks green, merge, sync main and Notion, then delete the branch.
