# M12: Launch Operator Console Hardening Plan

> Operator workflow slice. No schema changes and no new public endpoints.

## Goal

Make the admin dashboard actionable during the first controlled launch by
showing the existing M8 ops-status signals where operators already work.

## Tasks

- [x] Start from clean synced `main`.
- [x] Create `codex/launch-operator-console-hardening`.
- [x] Add `docs/superpowers/specs/2026-04-24-launch-operator-console-hardening-design.md`.
- [x] Extend the admin dashboard projection with bounded launch signal counts.
- [x] Add dashboard callouts for launch prerequisites, dispatch attention, and
      payment follow-up.
- [x] Link payment follow-up items to existing admin request detail pages.
- [x] Add focused domain test coverage for the composed ops-status projection.
- [x] Run focused deterministic checks.
- [x] Run `pnpm verify-slice`, static review, reviewer pool, and required gates.
- [ ] Open PR and fix Copilot/Sonar/CI feedback.
- [ ] Merge only after all required checks, including PR Finalizer, are green.
- [ ] Sync Notion, delete local and remote branch, and start the next slice from
      fresh `main`.

## Validation

```bash
pnpm --filter @nurseconnect/domain-admin-ops test
pnpm -w type-check
pnpm lint
pnpm --filter web build
```

Before merge, use the normal NurseConnect slice workflow and required CI gates.
