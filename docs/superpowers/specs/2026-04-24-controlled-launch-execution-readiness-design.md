# M13: Controlled Launch Execution Readiness Design

## Goal

Convert the completed launch hardening work into one final operator decision
package for controlled launch execution.

M13 is intentionally documentation and verification focused. It should not add
new product behavior unless the readiness review exposes a real launch blocker.

## Scope

- Add a controlled-launch execution readiness runbook.
- Make GO, HOLD, and NO-GO decisions explicit.
- Define hard launch gates and soft gates.
- Connect launch readiness, automated rehearsal, first-hour monitoring, auth
  monitoring, and the launch operator console into one final decision flow.
- Update the launch readiness verifier so the controlled-launch runbook remains
  part of the launch evidence set.
- Update canonical runbooks and legacy plan references so M9 through M12 are
  reflected in the launch evidence.

## Non-Scope

- New user-facing product features.
- Public status page.
- New monitor transport or alerting provider.
- Payment settlement, payout automation, or reimbursement workflows.
- Broad UI redesign.

## Design Decisions

### Decision Model

The final decision model is three-state:

- `GO`: all hard gates green, any soft gates explicitly accepted.
- `HOLD`: launch remains closed while a bounded soft-gate mitigation completes.
- `NO-GO`: any hard gate is red, production state cannot be verified, or a
  secret/token exposure occurs.

This is stricter than the existing launch day card because it separates a
recoverable operational delay from a launch-blocking failure.

### Evidence Boundaries

The decision package references existing commands instead of creating a second
source of truth:

- `pnpm gate:release`
- `pnpm launch:readiness`
- `pnpm launch:rehearsal`
- `pnpm launch:monitor`
- `pnpm launch:auth-monitor`
- `GET /api/health`
- authenticated `GET /api/admin/ops/status`
- Admin -> Dashboard -> Launch operator signals

Secrets and PHI must remain out of the decision ledger.

### Verifier

`scripts/launch-readiness-report.mjs` should require the new controlled-launch
runbook and the launch readiness review should contain a controlled-launch
decision section. This keeps the final decision package visible in CI/local
readiness output.

## Acceptance Criteria

- `docs/runbooks/controlled_launch_execution_readiness.md` exists and contains
  purpose, inputs, hard gates, soft gates, outcomes, decision ledger, and
  post-decision handoff.
- `docs/runbooks/launch_readiness_review.md` references M9-M12 evidence and
  includes a controlled-launch execution decision section.
- `docs/runbooks/launch_day_card.md` uses GO/HOLD/NO-GO language.
- `docs/runbooks/production_bootstrap_runbook.md` points operators to the final
  decision runbook before opening intake.
- `docs/v1.0.0-plan.md` no longer says the current program sequence stops at
  M8.
- `pnpm launch:readiness` passes.
- `pnpm test:scripts` passes.
