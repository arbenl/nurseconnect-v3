# M10: First-Hour Production Synthetic Monitoring Design

Date: 2026-04-24
Status: Approved for implementation
Scope: Read-only launch monitor script, runbook updates, and readiness wiring

## Purpose

M10 turns the M8 production monitoring endpoints into an operator-run launch
monitor for the first hour after deploy.

The monitor is intentionally read-only. It does not create users, mutate
requests, write audit rows, or change product behavior.

## Context

M8 added:

- `GET /api/health`
- `GET /api/admin/ops/status`
- `OPS_ALERT_WEBHOOK_URL` for failed payment and payout audit events
- launch runbook thresholds

M9 reconciled the roadmap and made M10 the next launch-hardening slice.

## Design

Add a root command:

```bash
pnpm launch:monitor -- --url https://production.example.com
```

Default behavior:

- polls `/api/health`
- runs 12 samples
- waits 5 minutes between samples
- covers the first hour after deploy
- exits nonzero on launch-blocking failures

Fast/smoke behavior:

```bash
pnpm launch:monitor -- --url https://production.example.com --once
pnpm launch:monitor -- --url https://production.example.com --once --json
```

Admin ops status is optional because the endpoint is authenticated:

```bash
LAUNCH_MONITOR_ADMIN_COOKIE='better-auth.session_token=...' \
  pnpm launch:monitor -- --url https://production.example.com
```

The cookie is passed as an HTTP `Cookie` header and is never printed.

## Thresholds

The monitor fails when:

- `/api/health` is not HTTP 2xx
- `/api/health.ok` is not `true`
- DB status is not `ok`
- active service area count is 0
- verified and available nurse supply is 0
- admin ops status is requested and returns non-2xx
- admin ops status DB is not `ok`
- unassigned requests is 3 or more
- stale enroute requests exist
- exception queue is 5 or more
- recent failed payment authorizations exist
- recent failed payouts exist

The monitor warns, but does not fail, when:

- stale assigned requests exist
- payment authorizations without payout exist

These warning states require operator attention but are not always launch-stop
conditions in a single sample.

## Output

Human output is optimized for an operator watching the terminal.

JSON output is optimized for CI, dashboards, or future automation:

```json
{
  "ok": true,
  "target": "https://production.example.com",
  "iterations": 12,
  "opsStatusPolled": true,
  "failures": [],
  "warnings": [],
  "samples": []
}
```

## Non-Goals

- No browser automation in this slice.
- No synthetic request creation.
- No login automation.
- No public status page.
- No Sentry integration.
- No alert delivery beyond the existing M8 webhook behavior.

## Acceptance Criteria

- `package.json` exposes `launch:monitor`.
- `scripts/launch-monitor.mjs` supports human output and `--json`.
- `scripts/launch-monitor.mjs --help` exits zero without network access.
- `pnpm launch:readiness` verifies the new command and script.
- Launch runbooks document first-hour monitor usage.
- The slice remains read-only.
