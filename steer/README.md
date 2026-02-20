# Steer Orchestration

This directory contains the deterministic multi-agent control configuration and workflow for agent-based development planning.

## Current setup

- `steer/steer.config.json`: policy and agent catalog.
- `scripts/steer-run.mjs`: run required agents for a task and write machine-readable artifacts.
- `scripts/steer-verify.mjs`: validate required artifacts and required agent outputs.
- `schemas/steer-output.schema.json`: strict schema contract for agent outputs and run manifest.

## Running locally

Run a task:

```bash
node scripts/steer-run.mjs <TASK_ID> --risk <low|medium|high>
```

Examples:

```bash
node scripts/steer-run.mjs 1-auth-roles --risk high
node scripts/steer-run.mjs 2-request-creation --risk medium --include-optional
```

Verify artifacts:

```bash
node scripts/steer-verify.mjs 1-auth-roles --risk high
```

Or via npm scripts:

```bash
pnpm steer:run -- 1-auth-roles --risk high
pnpm steer:verify -- 1-auth-roles --risk high
pnpm steer:orchestrate -- 1-auth-roles --risk high
pnpm steer:orchestrate -- 1-auth-roles --risk high --include-optional
pnpm agents:orchestrate -- 1-auth-roles --risk high
pnpm agents:orchestrate:verify -- 1-auth-roles --risk high
```

`pnpm steer:orchestrate` executes:

1. `steer:run`
2. `steer:verify`

and exits non-zero on any failure.

`--include-optional` enables optional agents for the selected risk profile during run.

### Strict schema mode

Both run and verify enforce schema validation locally:

- `agentOutputs.<agent>.json` must match `schemas/steer-output.schema.json#/agentOutput`.
- `artifacts/<TASK>/manifest.json` must match `schemas/steer-output.schema.json#/manifest`.
- `agents:orchestrate:verify` fails if any required artifact or schema contract is missing or invalid.

## What gets produced

Artifacts are written to `artifacts/<TASK_ID>/`:

- `manifest.json`: run summary and ordered agent results.
- `agentOutputs.<agent>.json`: copied planner output for each executed agent (`dev`, `qa`, `security`, `ops`, etc.).
- `agent.<agent>.log.txt`: raw stdout/stderr output from the agent run.
- `validation.json`: structured run-validation result (`pass`/`fail`) with machine-readable reasons.
- `validation.json` conforms to `schemas/steer-output.schema.json#/validation`.
- `signature.json`: compact digest summary.
- `verification.json`: pass/fail verification report.

### Failure diagnostics

- `artifacts/<TASK>/validation.json` is always produced after run.
- On success:
  - `validation.status = "pass"`
- On failure:
  - `validation.status = "fail"`
  - `validation.errors` contains objects (`kind`, `agentId`, `reason`) for deterministic debugging.
- `agents:orchestrate:verify` also checks the validation report status and fails when status is `fail`.

## Agent naming

`steer.config.json` keeps two fields per role:

- `agent_id`: stable script id (`dev`, `qa`, `security`, `ops`, ...).
- `name`: human-readable role name used in manifests (`Architect`, `Verifier`, `Threat Analyst`, etc.).

This keeps tooling stable while giving reports clearer labels.
