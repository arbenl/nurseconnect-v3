# SonarCloud PR Quality Gate Parity

## Problem

NurseConnect currently has a separate `Sonar Baseline` workflow that is
path-filtered and runs `SONAR_ENFORCEMENT=warn`. That means most pull requests
do not receive a Sonar check, and the check is not a hard quality gate when it
does run.

Interdomestik-style parity for NurseConnect means every pull request gets a
blocking Sonar quality-gate signal and a PR-facing summary before merge.

## Scope

- Add a `Sonar Quality Gate` job to the main CI workflow so `PR Finalizer` can
  depend on it without cross-workflow race conditions.
- Run coverage in a separate no-secret CI job and pass coverage artifacts into
  the scanner job.
- Run Sonar on every pull request to `main` with hard enforcement.
- Keep the scheduled/manual `Sonar Baseline` workflow for baseline evidence,
  but do not use warn mode for pull-request enforcement.
- Add a narrow PR-summary job that posts or updates a GitHub PR summary from
  uploaded Sonar evidence without exposing `SONAR_TOKEN` to PR-write steps.
- Make `PR Finalizer` require the `Sonar Quality Gate` check.
- Add tests that prevent the workflow from drifting back to path-filtered warn
  mode.

## Non-Goals

- Do not change SonarCloud project-side quality gate thresholds.
- Do not configure the SonarCloud GitHub App from code. The SonarCloud project
  still needs to be bound to this GitHub repository in SonarCloud settings for
  native `sonarqubecloud` decoration.
- Do not change application behavior.

## Implementation Notes

- The blocking PR CI job uses the official SonarQube scan action with explicit
  pull-request parameters.
- Coverage generation runs in a separate job before the Sonar token is present
  in the environment.
- The PR summary job runs after the gate with `if: always()` so a failed gate
  still publishes useful diagnostics when evidence exists.
- The PR summary job must not run repository-controlled scripts.
- Missing Sonar configuration must fail the PR job. A skipped Sonar job is not
  quality-gate parity.

## Validation

- `pnpm test:scripts`
- `pnpm launch:readiness`
- `pnpm verify-slice`
- `pnpm verify-slice -- --run-root <run_root> --static`
- reviewer pool
- `pnpm verify-slice -- --run-root <run_root> --required-gates`
