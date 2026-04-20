# M6: Automated Launch Rehearsal Plan

## Goal

Add a repeatable automated launch rehearsal gate that verifies the launch-day
operational path from API health through request lifecycle, payment trace,
partner intake, and exception triage.

## Steps

1. Add `apps/web/tests/e2e-api/launch-rehearsal.api.e2e.ts`.
2. Add `web` script `test:e2e:launch-rehearsal`.
3. Add `scripts/launch-rehearsal.sh` with test database enforcement and clean
   schema preparation.
4. Add root script `launch:rehearsal`.
5. Update `scripts/launch-readiness-report.mjs` so readiness confirms the new
   rehearsal script and test file exist.
6. Update launch runbooks to reference `pnpm launch:rehearsal`.
7. Run focused and release validation.
8. Open PR, fix review feedback, wait for all checks including PR Finalizer,
   merge, sync `main`, update Notion, and delete the branch.

## Acceptance Criteria

- `pnpm launch:rehearsal` runs readiness and the focused Playwright API
  rehearsal.
- The rehearsal proves the launch flow across admin, patient, nurse, partner,
  payment trace, and triage exception APIs.
- Existing `pnpm gate:e2e-api` includes the new rehearsal test.
- Readiness report includes the M6 command and test artifact.
