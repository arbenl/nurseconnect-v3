# M10: First-Hour Production Synthetic Monitoring Plan

> Read-only launch-hardening slice. No application runtime behavior changes.

## Goal

Add a repeatable first-hour launch monitor command over the M8 health and ops
status endpoints.

## Tasks

- [ ] Start from clean synced `main`.
- [ ] Create `codex/first-hour-production-synthetic-monitoring`.
- [ ] Add `scripts/launch-monitor.mjs`.
- [ ] Wire `pnpm launch:monitor` in root `package.json`.
- [ ] Add `launch:monitor` to launch readiness verification.
- [ ] Update launch runbooks with first-hour monitor commands.
- [ ] Validate help, JSON shape, and readiness checks locally.
- [ ] Open PR and fix Copilot/Sonar/CI feedback.
- [ ] Merge only after all required checks, including PR Finalizer, are green.
- [ ] Sync Notion, delete local and remote branch, and start the next slice from
      fresh `main`.

## Command Contract

```bash
pnpm launch:monitor -- --url https://production.example.com
pnpm launch:monitor -- --url https://production.example.com --once --json
LAUNCH_MONITOR_ADMIN_COOKIE='better-auth.session_token=...' \
  pnpm launch:monitor -- --url https://production.example.com
```

## Validation

```bash
node scripts/launch-monitor.mjs --help
pnpm launch:readiness
pnpm launch:readiness:json
```

Before merge, use the normal branch workflow and required CI gates.
