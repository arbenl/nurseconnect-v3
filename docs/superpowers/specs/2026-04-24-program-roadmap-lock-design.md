# M15: Program Roadmap Lock Design

Date: 2026-04-24
Status: Approved for documentation slice
Scope: Program roadmap, milestone ordering, CRM boundary placement

## Purpose

M15 stops the project from creating milestones opportunistically. It locks the
post-M14 NurseConnect program sequence in the repository before any new product
surface, especially CRM, is implemented.

This is a documentation and program-control slice. It does not change runtime
behavior, database schema, routes, UI, or launch gates.

## Problem

The v1.0.0 program was coherent through M14:

- M1-M8 delivered launch product and operations capabilities.
- M9 reconciled the roadmap.
- M10-M14 hardened launch monitoring, auth monitoring, operator visibility,
  launch execution readiness, and browser rehearsal reliability.
- The Sonar quality-gate parity slice then improved merge discipline, but it
  was infrastructure parity rather than a predeclared numbered milestone.

After that, jumping directly to "build a CRM" would repeat the problem: CRM is a
large product boundary that touches relationship history, partner accounts,
operator notes, follow-ups, PII/PHI handling, audit trails, and existing source
of truth models.

## Program Rule

New milestones must come from the locked sequence below, or from an explicit
roadmap amendment slice that updates the program before implementation begins.

Infrastructure parity slices may remain unnumbered when they do not change
product scope, but they must still be recorded in the Program page after merge.

## Locked Sequence

| Milestone | Name | Type | Status | Launch blocker? | Exit criteria |
| --- | --- | --- | --- | --- | --- |
| M15 | Program Roadmap Lock | Documentation/program control | This slice | No | Repo docs lock the next sequence; Notion is synced after merge with PR and merge-commit evidence. |
| M16 | CRM Boundary Design | Product design | Planned | No | CRM actors, data ownership, PII/PHI guardrails, audit actions, and first implementation slice are defined. |
| M17 | Controlled Launch Dry Run and Decision Ledger | Launch execution | Planned | Yes for launch execution | Full launch decision package is rehearsed from clean main with current monitors, browser rehearsal, and operator ledger. |
| M18 | CRM Read-Only Operator View | Product implementation | Planned after M16 approval and launch dry-run evidence | No by default; deferrable outside launch path | Admin can view minimum-necessary relationship summaries derived from existing operational records without new mutable CRM records. |
| M19 | CRM Notes and Follow-Ups | Product implementation | Planned after M18 evidence | No by default; deferrable outside launch path | Admin-only non-clinical notes/follow-ups exist with audit trail, access controls, and PHI-minimizing guidance. |

## CRM Placement

CRM is not a v1.0.0 launch prerequisite. It belongs to the post-launch
commercial operating loop unless the operator explicitly narrows it to a
read-only relationship dashboard. Controlled launch dry-run evidence may proceed
before any CRM implementation.

The first CRM slice must be M16 design, not implementation.

### CRM v1 Definition

For NurseConnect, CRM means operator relationship context around:

- referral partners and their submitted demand
- patients and request history
- nurses and credential/availability relationship context
- operator follow-ups and non-clinical notes
- request, payment, triage, and audit timeline rollups

CRM projections must be admin-only, minimum-necessary, and redacted. Raw payment
metadata, raw audit/security metadata, session data, credentials, and secrets
must not be surfaced as CRM relationship content.

CRM does not mean:

- clinical records
- diagnosis notes
- free-text clinical documentation
- insurance reimbursement workflows
- settlement execution
- broad care-management casework
- partner-branded portals

CRM notes must include operator guidance that prohibits diagnoses, clinical
assessment text, credentials, secrets, payment card data, and unnecessary PHI.

## Expected Repo Impact After M16 Approval

CRM implementation may touch:

- `packages/database` for notes/follow-ups only after source-of-truth boundaries
  are approved.
- `packages/contracts` for admin CRM DTOs.
- `packages/domain-admin-ops` or a new `packages/domain-crm` for read-only
  projections; M16 must decide ownership before implementation.
- `packages/platform-telemetry` for CRM audit actions.
- `apps/web` for admin CRM pages and API routes.

CRM implementation must not duplicate existing source-of-truth data from users,
nurses, referral partners, service requests, service areas, payment traces, or
admin audit logs.

## Acceptance Criteria

- Repo docs identify M0-M14 as complete and Sonar parity as merged
  infrastructure parity.
- The next numbered sequence is explicit and ordered.
- CRM is placed as M16 design before any CRM build slice.
- Launch docs no longer imply M10-M12 are still pending.
- Notion Program and roadmap are updated after merge with PR and merge-commit
  evidence.
