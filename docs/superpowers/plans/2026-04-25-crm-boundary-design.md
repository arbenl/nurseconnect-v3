# M16: CRM Boundary Design Plan

Date: 2026-04-25
Status: Done - merged via PR #68
Scope: Product boundary design only

Branch: `codex/crm-boundary-design`

Design:
[M16 CRM Boundary Design](../specs/2026-04-25-crm-boundary-design.md)

Review scope: verify-slice reviewer pool for a design-only slice with no
runtime changes; selected reviewers covered security, architecture, QA, and
ops.

## Goal

Define the NurseConnect CRM boundary before any CRM implementation begins.

This slice decides actors, source-of-truth ownership, PII/PHI guardrails, audit
requirements, and the first implementation slice. It does not add database
schema, API routes, UI, package exports, or runtime behavior.

## Checklist

- [x] Start from clean, synced `main`.
- [x] Create fresh branch.
- [x] Add the M16 CRM boundary design.
- [x] Cross-reference M16 from roadmap docs.
- [x] Run focused docs/static checks.
- [x] Run `pnpm verify-slice`.
- [x] Run `pnpm verify-slice -- --static`.
- [x] Run reviewer pool or document lightweight docs-only review scope.
- [x] Run `pnpm verify-slice -- --required-gates`.
- [x] Complete standard slice workflow (PR -> CI -> merge -> Notion sync ->
      branch cleanup) from [AGENTS.md](../../../AGENTS.md).

## Scope

See [M16 CRM Boundary Design](../specs/2026-04-25-crm-boundary-design.md) for
full scope. This plan records the docs-only execution slice and verification
workflow.

## Out of scope

- CRM database schema.
- CRM API routes.
- CRM UI.
- CRM notes/follow-up mutations.
- Patient, nurse, referral partner, request, payment, audit, or auth behavior
  changes.
