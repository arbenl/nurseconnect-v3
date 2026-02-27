# NurseConnect Multi-Agent SOP

## Purpose
This SOP defines the day-to-day runbook for engineering and release managers using the NurseConnect multi-agent orchestration framework.

## Preconditions
- Run from any subdirectory in the repository; repo root is discovered dynamically via `git rev-parse --show-toplevel` with cwd fallback.
- Keep all orchestration behavior in `config/multi-agent.config.json`.
- For healthcare safety, do not disable compliance lane checks for PHI/secrets/auditability.

## Standard Execution (Auto Policy)
1. Evaluate policy:
   - `pnpm multiagent:policy -- --mode auto --complexity 7 --estimated-cost-usd 8 --budget-usd 20 --independent-task-count 2 --requires-compliance-review true`
2. Execute orchestration:
   - `pnpm multiagent:run -- --task release-gate-<ticket> --mode auto --complexity 7 --estimated-cost-usd 8 --budget-usd 20 --independent-task-count 2 --requires-compliance-review true`
3. Review evidence artifacts:
   - `tmp/multi-agent/run-<id>/events.ndjson`
   - `tmp/multi-agent/run-<id>/role-scorecard.json`
   - `tmp/multi-agent/run-<id>/steps/*.log.txt`

## Required Lane Outcomes
- `preflight-agent`: environment and baseline readiness checks.
- `gatekeeper`: release gate command execution.
- `testing-agent`: test command execution.
- `compliance-agent`: PHI/secrets/auditability scan and remediation notes.
- `verification-agent`: auto remediation retries for failed verification commands.
- `finalizer-agent`: run-level artifact finalization.

## Release Manager Checklist
1. Confirm `role-scorecard.json` has `status: pass`.
2. Confirm `compliance-agent` has `status: pass`.
3. Confirm `verification-agent` did not exhaust retries.
4. Run finalization discipline:
   - `pnpm multiagent:finalizer -- --run-local-checks true`
5. If any check fails, use remediation notes in scorecard and rerun.

## Weekly Benchmark
- Run weekly scorecard generation:
  - `pnpm multiagent:benchmark:weekly`
- Share generated markdown scorecard with engineering leadership.

## External A2A Handoff
- Export internal request to A2A envelope:
  - `pnpm multiagent:a2a -- export --type request --input <internal-request.json> --output <envelope.json>`
- Import A2A result envelope into internal format:
  - `pnpm multiagent:a2a -- import --type result --input <result-envelope.json> --output <internal-result.json>`
