# Multi-Agent Troubleshooting

## Path and Config Discovery Issues

### 1) Error: Missing config file
Message pattern:
- `Missing multi-agent config at ...config/multi-agent.config.json`

Actions:
1. Verify file exists: `ls config/multi-agent.config.json`
2. If using custom config location, run with `--config <path>`.
3. Ensure JSON is valid: `node -e "JSON.parse(require('fs').readFileSync('config/multi-agent.config.json','utf8'))"`

### 2) Wrong repository root selected
Cause:
- Command executed outside intended git checkout.

Actions:
1. Confirm git root: `git rev-parse --show-toplevel`
2. Re-run command from intended repository tree.
3. Use explicit cwd in automation/CI runner setup.

### 3) Relative output paths resolve unexpectedly
Cause:
- `paths.*` entries in config are relative to discovered repo root.

Actions:
1. Keep `paths.*` relative for portability.
2. Use absolute paths only when intentionally overriding defaults.
3. Confirm generated locations from command JSON output (`runDirectory`, `events`, `roleScorecard`).

### 4) Finalizer CI snapshot fails
Message pattern:
- snapshot check status `fail`

Actions:
1. Confirm configured command in `finalizer.ciSnapshotCommand` exists in environment.
2. Validate required CLI auth (`gh auth status`) when using GitHub checks.
3. Replace with an environment-safe snapshot command in config for local/offline contexts.

### 5) Compliance lane false positives
Cause:
- Pattern set may be too broad for local logging format.

Actions:
1. Review findings in `role-scorecard.json` and step logs.
2. Tighten regex in `compliance.phiLeakPatterns` / `compliance.secretPatterns`.
3. Re-run with updated config and verify findings clear.

## Verification Workflow Recovery
1. Run standalone remediation loop:
   - `pnpm multiagent:verify-fix -- --max-retries 2`
2. Inspect generated report in `tmp/multi-agent/verify-fix-*.json`.
3. Update `gates.verificationCommands` and `gates.verificationRemediationCommands` in config as needed.
