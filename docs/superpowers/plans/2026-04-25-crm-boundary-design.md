# M16: CRM Boundary Design Plan

Date: 2026-04-25
Status: In progress
Scope: Product boundary design only

Branch: `codex/crm-boundary-design`

Design:
[M16 CRM Boundary Design](../specs/2026-04-25-crm-boundary-design.md)

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
- [ ] Complete standard slice workflow (PR -> CI -> merge -> Notion sync ->
      branch cleanup) from [AGENTS.md](../../../AGENTS.md).

## Scope

- CRM actors and operator use cases.
- CRM source-of-truth and package ownership.
- Relationship summary data allowed in read-only CRM views.
- PII/PHI/payment/audit redaction rules.
- Audit actions required before mutable CRM work.
- M18 first implementation slice definition.
- M19 notes and follow-ups boundary.

## Out of scope

- CRM database schema.
- CRM API routes.
- CRM UI.
- CRM notes/follow-up mutations.
- Patient, nurse, referral partner, request, payment, audit, or auth behavior
  changes.
