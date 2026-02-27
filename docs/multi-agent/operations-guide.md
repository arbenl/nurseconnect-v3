# NurseConnect Multi-Agent Operations Guide

## 1. Overview
The multi-agent framework provides policy-driven execution for engineering tasks with structured evidence, healthcare-safe compliance gates, and release finalization discipline.

Core goals:
- Dynamically discover repository root (`git rev-parse --show-toplevel` or cwd fallback).
- Keep all commands, thresholds, and retry policies in one central file: `config/multi-agent.config.json`.
- Generate deterministic, auditable artifacts per run.

## 2. Architecture
### 2.1 Components
- Policy engine (`scripts/multi-agent/lib/policy-engine.mjs`): chooses `single` vs `multi` mode with deterministic reason codes.
- Orchestrator (`scripts/multi-agent/lib/orchestrator.mjs`): executes lanes and persists evidence.
- Compliance engine (`scripts/multi-agent/lib/compliance.mjs`): checks PHI leakage risk, secrets exposure, and gate auditability.
- Verification retry engine (`scripts/multi-agent/verify-fix.mjs` + orchestrator lane): retries with remediation commands.
- Finalizer discipline (`scripts/multi-agent/finalizer.mjs`): validates clean tree, pushed branch, and CI snapshot support.
- A2A adapter (`scripts/multi-agent/lib/a2a-adapter.mjs`): export/import envelopes with schema validation.

### 2.2 Lanes
Configured lane order (default):
1. `preflight-agent`
2. `gatekeeper`
3. `testing-agent`
4. `compliance-agent`
5. `verification-agent`
6. `finalizer-agent`

When policy mode is `multi`, configured parallel lanes (`gatekeeper`, `testing-agent`) run concurrently.

## 3. Configuration
All behavior is configured in:
- `config/multi-agent.config.json`

Key config sections:
- `repoRoot`: `auto` for dynamic root discovery.
- `paths`: run evidence locations.
- `gates`: lane commands and remediation commands.
- `policy.thresholds`: mode decision thresholds.
- `retryLimits`: command timeout and retry count.
- `roleCostProfile`: per-lane fixed and variable cost model.
- `compliance`: PHI/secret regexes and audit requirements.
- `benchmark`: standard scenarios and scorecard output file.
- `a2a`: protocol/version/kind/source/target defaults.
- `finalizer`: clean tree, branch push, CI snapshot, and local checks.

## 4. Commands
### 4.1 Execution and Policy
- `pnpm multiagent:run -- [flags]`
- `pnpm multiagent:policy -- [flags]`

### 4.2 Evidence and Metrics
- `pnpm multiagent:metrics -- [flags]`
- `pnpm multiagent:verify-fix -- [flags]`

### 4.3 Benchmarks
- `pnpm multiagent:benchmark -- [flags]`
- `pnpm multiagent:benchmark:weekly`

### 4.4 A2A Integration
- `pnpm multiagent:a2a -- export --type request --input <file> --output <file>`
- `pnpm multiagent:a2a -- import --type result --input <file> --output <file>`

### 4.5 Release Finalizer
- `pnpm multiagent:finalizer -- [flags]`
- Optional local CI snapshot override:
  - `pnpm multiagent:finalizer -- --allow-dirty true --ci-snapshot-command "echo ci-snapshot-unavailable"`

## 5. Evidence Artifacts
Per run output:
- `tmp/multi-agent/run-<id>/events.ndjson`
- `tmp/multi-agent/run-<id>/role-scorecard.json`
- `tmp/multi-agent/run-<id>/steps/*.log.txt`

Benchmark output:
- `tmp/multi-agent/benchmarks/<run>/scorecard.md`

Finalizer output:
- `tmp/multi-agent/finalizer/finalizer-<id>.json`
- `tmp/multi-agent/finalizer/ci-snapshot-<id>.txt`

## 6. Policy and Reason Codes
Policy emits deterministic codes in fixed order. Examples:
- `MODE_AUTO`
- `COMPLEXITY_HIGH|LOW`
- `INDEPENDENT_TASKS_HIGH|LOW`
- `COMPLIANCE_REQUIRED|NOT_REQUIRED`
- `COST_WITHIN_BUDGET|OVER_BUDGET`
- `SCORE_AT_OR_ABOVE_MULTI_THRESHOLD|SCORE_BELOW_MULTI_THRESHOLD`
- `AUTO_MULTI|AUTO_SINGLE`

## 7. Healthcare Compliance Lane
Compliance checks include:
- PHI leakage risk patterns (e.g., MRN, DOB labels, SSN-like values)
- Secret/token exposure patterns
- Missing auditable gate outputs from required lanes

If compliance fails, remediation notes are attached to `role-scorecard.json` and run logs.

## 8. A2A Contract
JSON schema contract:
- `schemas/multi-agent/a2a-envelope.schema.json`

Envelope kinds:
- `nurseconnect.multiagent.request`
- `nurseconnect.multiagent.result`

Protocol:
- `a2a/1.0`

## 9. Troubleshooting (Path/Config)
### Symptom: "Missing multi-agent config"
- Confirm `config/multi-agent.config.json` exists.
- Pass explicit config path with `--config <path>`.

### Symptom: Unexpected root path
- Run `git rev-parse --show-toplevel`.
- If outside git, run command from intended repo cwd.

### Symptom: Commands fail in lanes
- Check lane command mappings in `config/multi-agent.config.json`.
- Validate command availability (`pnpm`, `gh`, etc.).

### Symptom: No metrics output
- Confirm run created `events.ndjson`.
- Pass `--run-dir` or `--events` explicitly.

### Symptom: Benchmark scorecard missing
- Verify `benchmark.scenarios` is non-empty.
- Check write permissions under `tmp/multi-agent/benchmarks`.
