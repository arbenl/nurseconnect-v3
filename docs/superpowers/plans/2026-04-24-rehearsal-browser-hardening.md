# M14: Rehearsal Browser Hardening Plan

Branch: `codex/rehearsal-browser-hardening`

## Checklist

- [x] Define slice from watched Chrome rehearsal findings.
- [x] Create branch from clean synced `main`.
- [x] Fix rehearsal seed Better Auth `Origin` handling.
- [x] Add unit coverage for seed URL/origin behavior.
- [x] Disable Vercel client telemetry outside production.
- [x] Add headed slow browser rehearsal script and package command.
- [x] Update launch readiness verifier and runbook references.
- [x] Run deterministic local gates.
- [x] Run `pnpm verify-slice` and keep the `run_root`.
  - `run_root`: `tmp/multi-agent/verify-slice/verify-slice-20260424T190110Z-035f65`
- [x] Run static gate.
- [x] Run reviewer pool and fix `MUST_FIX` findings.
  - Fixed headed rehearsal wrapper to force `CI=1`.
  - Fixed runbook command block and seed session bootstrap failure handling.
- [x] Run required gates.
- [ ] Open PR.
- [ ] Fix CI/Sonar/Copilot findings.
- [ ] Merge, sync main, update Notion, delete branch.
