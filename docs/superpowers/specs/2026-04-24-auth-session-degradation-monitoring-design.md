# M11: Auth and Session Degradation Monitoring Design

Date: 2026-04-24
Status: Approved for implementation
Scope: Synthetic auth/session monitor, runbook updates, and readiness wiring

## Purpose

M11 detects launch-time auth and session degradation separately from product
workflow failures.

M8 and M10 prove that the app, database, service areas, nurse supply, and ops
signals are reachable. They do not prove that a real operator can sign in,
bootstrap a session through `/api/me`, and reach admin-only routes. M11 closes
that gap with a narrow synthetic monitor.

## Context

Existing launch monitoring covers:

- `GET /api/health`
- optional authenticated `GET /api/admin/ops/status`
- first-hour polling through `pnpm launch:monitor`

Existing auth surfaces already needed by launch operations:

- `POST /api/auth/sign-in/email`
- `GET /api/me`
- `GET /api/admin/ping`
- `POST /api/auth/sign-out`

M11 should reuse those surfaces. It should not add broad user telemetry, new
auth storage, or PHI-bearing logs.

## Design

Add a root command:

```bash
pnpm launch:auth-monitor -- --url https://production.example.com
```

The command performs one synthetic auth/session sample:

1. Sign in with a dedicated synthetic admin credential.
2. Call `GET /api/me` using the returned session cookie.
3. Confirm `/api/me` returns a user with role `admin`.
4. Call `GET /api/admin/ping` using the same session cookie.
5. Confirm admin RBAC returns HTTP 200 and role `admin`.
6. Sign out with the same cookie.

Credential source:

```bash
LAUNCH_AUTH_MONITOR_EMAIL='synthetic-admin@example.com' \
LAUNCH_AUTH_MONITOR_PASSWORD='<secret>' \
  pnpm launch:auth-monitor -- --url https://production.example.com
```

The email may be supplied by flag for local/manual runs:

```bash
pnpm launch:auth-monitor -- \
  --url https://production.example.com \
  --email synthetic-admin@example.com
```

The script must never print the password, full cookie value, session token, or
raw auth response body. Human output should include only endpoint names, HTTP
status, and coarse result labels. JSON output should include the same redacted
information. The password is environment-only to keep it out of shell history
and process listings. The target URL must be HTTPS except for explicit
localhost development targets.

## Thresholds

The monitor fails nonzero when:

- credentials are missing
- the target URL is not HTTPS, except explicit localhost development targets
- sign-in returns non-2xx
- sign-in does not produce a usable session cookie
- `/api/me` returns non-2xx
- `/api/me` does not return a user
- `/api/me.user.role` is not `admin`
- `/api/admin/ping` returns non-2xx
- `/api/admin/ping.user.role` is not `admin`

The monitor warns, but does not fail, when sign-out fails after all positive
auth and admin checks passed. This keeps the primary degradation signal focused
on login/session/admin reachability while still requiring operator cleanup.

## Output

Human output is optimized for launch operators:

```text
NurseConnect auth/session monitor
Target: https://production.example.com
PASS sign-in HTTP 200 sessionCookie=present
PASS /api/me HTTP 200 role=admin
PASS /api/admin/ping HTTP 200 role=admin
PASS sign-out HTTP 200
Auth/session monitor checks passed.
```

JSON output is optimized for CI, dashboards, and future monitor integration:

```json
{
  "ok": true,
  "generatedAt": "2026-04-24T00:00:00.000Z",
  "target": "https://production.example.com",
  "timeoutMs": 10000,
  "failures": [],
  "warnings": [],
  "steps": [
    { "name": "sign-in", "ok": true, "status": 200 },
    { "name": "me", "ok": true, "status": 200, "role": "admin" },
    { "name": "admin-ping", "ok": true, "status": 200, "role": "admin" },
    { "name": "sign-out", "ok": true, "status": 200 }
  ]
}
```

## Runbook Requirements

Update:

- `docs/runbooks/launch_day_card.md`
- `docs/runbooks/launch_readiness_review.md`
- `docs/runbooks/production_bootstrap_runbook.md`

The runbooks must document:

- required synthetic admin environment variables
- the one-shot auth monitor command
- first-hour cadence alongside `pnpm launch:monitor`
- no-go threshold when login, session bootstrap, or admin ping fails
- prohibition on committing or logging credentials/cookies

## Non-Goals

- No new auth provider.
- No client-side telemetry.
- No per-user auth analytics.
- No database migrations.
- No synthetic request creation.
- No public status page.
- No use of test-only `/api/test/login` in production monitoring.

## Acceptance Criteria

- `package.json` exposes `launch:auth-monitor`.
- `scripts/launch-auth-monitor.mjs` supports human output and `--json`.
- `scripts/launch-auth-monitor.mjs --help` exits zero without network access.
- `pnpm launch:readiness` verifies the command and script.
- The monitor validates sign-in, `/api/me`, `/api/admin/ping`, and sign-out.
- The monitor redacts credentials and cookies in all output.
- API coverage confirms the auth/session/admin path with an admin user.
- Launch runbooks document auth/session degradation response.
