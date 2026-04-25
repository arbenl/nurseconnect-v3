# Program Docs Polish Plan

Date: 2026-04-25
Status: In progress
Scope: Documentation polish only

Branch: `codex/program-docs-polish`

## Goal

Apply post-M15 documentation review comments without changing runtime behavior,
schema, routes, or launch gates.

## Checklist

- [x] Start from clean, synced `main`.
- [x] Create fresh branch.
- [x] Normalize reviewed docs for status clarity, scannability, and links.
- [x] Run focused docs/static checks.
- [x] Run `pnpm verify-slice`.
- [x] Run `pnpm verify-slice -- --static`.
- [x] Run reviewer pool or document lightweight docs-only review scope.
- [x] Run `pnpm verify-slice -- --required-gates`.
- [ ] Complete standard slice workflow (PR -> CI -> merge -> Notion sync ->
      branch cleanup) from [AGENTS.md](../../../AGENTS.md).

## Scope

- M15 roadmap-lock design and plan.
- Historical v1.0.0 plan.
- Blueprint durable strategy doc.
- M9 superseded roadmap reconciliation doc.
- Launch readiness runbook.

## Out of scope

- Runtime code changes.
- Database migrations.
- API, auth, proxy, routing, or contract changes.
- New CRM implementation.
