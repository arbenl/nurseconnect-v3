# M15: Program Roadmap Lock Plan

Branch: `codex/program-roadmap-lock`
Design: [M15 Program Roadmap Lock Design](../specs/2026-04-24-program-roadmap-lock-design.md)

## Goal

Lock the NurseConnect post-M14 program sequence before starting CRM or another
product surface.

## Checklist

- [x] Start from clean, synced `main`.
- [x] Create fresh branch.
- [x] Add M15 design spec.
- [x] Update repo roadmap and launch docs for post-M14 state.
- [x] Run focused docs/static checks.
- [x] Run `pnpm verify-slice`.
- [x] Run `pnpm verify-slice -- --static`.
- [x] Run reviewer pool or document lightweight docs-only review scope.
- [x] Run `pnpm verify-slice -- --required-gates`.
- [x] Complete standard slice workflow (PR -> CI -> merge -> Notion sync ->
      branch cleanup) from [AGENTS.md](../../../AGENTS.md).

## Scope

- Program roadmap docs.
- Launch evidence docs.
- CRM boundary placement.

## Out of scope

- CRM database schema.
- CRM UI.
- CRM API routes.
- Runtime launch behavior changes.
