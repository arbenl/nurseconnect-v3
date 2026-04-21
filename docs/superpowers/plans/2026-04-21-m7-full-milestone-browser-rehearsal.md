# M7: Full Milestone Browser Rehearsal Plan

## Goal

Add one live Playwright browser rehearsal that proves the already-built v1.0.0
milestones work together as one operational path.

## Steps

1. Add deterministic M7 Playwright fixture setup for admin, nurse, partner,
   patient, verified nurse supply, service area, and partner profile.
2. Add one UI test using `test.step()` for M0/M5/M6 readiness entry, M4 service
   area visibility and dispatch behavior, M3 payment/payout trace, M1 partner referral,
   M2 exception triage, and final admin evidence.
3. Add a focused web script for the M7 browser rehearsal.
4. Add a root launch script that runs readiness, the M6 API rehearsal, a clean DB
   reset, contracts build, and the M7 browser rehearsal.
5. Run the focused browser rehearsal in a live Playwright browser.
6. Run the usual validation gates before PR.
7. Open PR, fix Copilot/Sonar issues, wait for all checks including PR
   Finalizer, merge, sync main, update Notion, and delete the branch.

## Acceptance Criteria

- The browser test logs in through `/login` for every actor.
- The browser drives visible UI for service-area coverage, patient request, nurse
  lifecycle, partner request/detail, admin payment trace, exception queue, and
  admin evidence.
- The test uses `test.step()` for milestone traceability.
- The launch script can run the M5/M6 preconditions before M7.
