# M11: Auth and Session Degradation Monitoring Plan

> Launch-hardening slice. No schema changes and no broad user telemetry.

## Goal

Add a focused synthetic auth/session monitor so launch operators can distinguish
auth/session degradation from product workflow or ops-status failures.

## Tasks

- [x] Start from clean synced `main`.
- [x] Create `codex/auth-session-degradation-monitoring`.
- [x] Add `docs/superpowers/specs/2026-04-24-auth-session-degradation-monitoring-design.md`.
- [x] Add `scripts/launch-auth-monitor.mjs`.
- [x] Wire `pnpm launch:auth-monitor` in root `package.json`.
- [x] Add `launch:auth-monitor` and script checks to `scripts/launch-readiness-report.mjs`.
- [x] Add focused tests for auth/session/admin reachability and redaction.
- [x] Update launch runbooks with auth monitor usage and thresholds.
- [ ] Run focused deterministic checks.
- [ ] Run `pnpm verify-slice`, static review, reviewer pool, and required gates.
- [ ] Open PR and fix Copilot/Sonar/CI feedback.
- [ ] Merge only after all required checks, including PR Finalizer, are green.
- [ ] Sync Notion, delete local and remote branch, and start the next slice from
      fresh `main`.

## Command Contract

```bash
LAUNCH_AUTH_MONITOR_EMAIL='synthetic-admin@example.com' \
LAUNCH_AUTH_MONITOR_PASSWORD='<secret>' \
  pnpm launch:auth-monitor -- --url https://production.example.com

pnpm launch:auth-monitor -- --url https://production.example.com --json
pnpm launch:auth-monitor -- --help
```

The password is environment-only. Do not pass it as a CLI argument.

The command must:

- call `POST /api/auth/sign-in/email`
- extract the Better Auth session cookie without printing it
- call `GET /api/me`
- call `GET /api/admin/ping`
- call `POST /api/auth/sign-out`
- fail nonzero on login, session, or admin reachability failure

## Validation

```bash
node scripts/launch-auth-monitor.mjs --help
pnpm launch:readiness
pnpm launch:readiness:json
pnpm --filter web test:e2e:api -- auth.api.e2e.ts
```

Before merge, use the normal NurseConnect slice workflow and required CI gates.
