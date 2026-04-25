# M16: CRM Boundary Design

Date: 2026-04-25
Status: Ready for review
Scope: CRM actors, data ownership, privacy guardrails, audit actions, and first
implementation slice

## Purpose

M16 defines the CRM boundary before NurseConnect adds any CRM runtime surface.

CRM is useful for operators, but it cuts across patients, referral partners,
nurses, requests, visits, payments, audit logs, and launch operations. Without a
boundary, CRM would duplicate existing source-of-truth data and risk exposing
more PII or PHI than an operator needs.

This slice is design-only. It does not add tables, contracts, routes, UI, or
package exports.

## Decision

NurseConnect CRM starts as an admin-only relationship projection, not as a new
source-of-truth system.

M18 should implement the first read-only CRM operator view inside
`@nurseconnect/domain-admin-ops`, following the existing admin projection
pattern. A new `@nurseconnect/domain-crm` package is deferred until CRM owns
mutable business records, starting with M19 notes and follow-ups.

This keeps M18 small and avoids adding a package before the domain has its own
lifecycle or invariants.

## Actors

### Admin Operator

The admin operator is the only CRM actor for M18 and M19.

Allowed goals:

- find a patient or referral partner relationship quickly
- inspect minimum-necessary request history
- understand whether a relationship has active exceptions or payment follow-up
- prepare a non-clinical follow-up
- navigate to existing operational detail pages for deeper work

Disallowed goals:

- edit clinical content
- document diagnoses or assessments
- execute settlement, reimbursement, or payout operations from CRM
- bypass existing nurse, partner, request, payment, or audit workflows

### Patient

Patients are CRM subjects, not CRM users. Patient-facing surfaces remain the
dashboard and request/visit views.

### Referral Partner

Referral partners are CRM subjects and external demand actors. Their own portal
remains scoped to partner-submitted requests.

### Nurse

Nurses are CRM subjects only where operator relationship context is needed.
Credential and availability source-of-truth remains in the nurse domain.

## Source-of-Truth Ownership

| Area | Existing owner | CRM rule |
| --- | --- | --- |
| Users, roles, profile fields | `@nurseconnect/domain-identity` and `users` | CRM may read minimum-necessary identity fields. CRM must not own user records or role changes. |
| Patient request history | `@nurseconnect/domain-request` and `@nurseconnect/domain-visit` | CRM may summarize request counts, latest request states, and safe timeline hints. CRM must not own patient lifecycle state. |
| Referral partners | `@nurseconnect/domain-referral` | CRM may show partner organization, status, and referral demand summaries. CRM must not mutate partner profiles. |
| Nurses and credentials | `@nurseconnect/domain-nurse` | CRM may show credential status, jurisdiction, expiration date, and availability summary. CRM must not reveal license numbers or mutate credential state. |
| Dispatch and service areas | `@nurseconnect/domain-dispatch` and service-area admin code | CRM may show dispatch relationship context and service-area labels or coarse hints. CRM must not assign or reassign requests. |
| Payments and payouts | `@nurseconnect/domain-payments` | CRM may show status/count/gap flags. CRM must not expose provider references, notes, failure reasons, or execute payment operations. |
| Admin audit and ops | `@nurseconnect/platform-telemetry` and `@nurseconnect/domain-admin-ops` | CRM reads and writes must be auditable, but CRM must not expose raw audit details as relationship content. |

## CRM v1 Includes

CRM v1 may include:

- admin-only patient, referral partner, and later nurse relationship summaries
- entity IDs used for navigation
- role and operational status
- created and updated timestamps
- referral partner organization and status
- request counts and latest request summaries
- request status, type, source, broad care type, and assignment state
- redacted location hints
- exception queue and payment follow-up flags
- nurse credential status, jurisdiction, expiration date, and availability state
- non-clinical follow-up state after M19

## CRM v1 Excludes

CRM v1 excludes:

- clinical records
- diagnoses
- assessment text
- free-text clinical documentation
- insurance reimbursement workflows
- settlement execution
- payment card or bank data
- credentials and secrets
- session cookies or auth tokens
- raw auth account/session data
- raw audit/security metadata
- raw payment provider metadata
- duplicated copies of users, nurses, referral partners, requests, service
  areas, payment traces, or audit logs

## Redaction Rules

M18 read-only CRM projections must redact or omit:

- full addresses; use city, service-area label, or short location hints instead
- exact latitude and longitude
- license numbers
- raw payment provider references
- raw request-event `meta`
- raw admin audit `details`
- payment and payout notes
- payment and payout failure reasons
- timeline actor IDs unless needed for an admin-owned audit drill-in
- contact fields unless the specific CRM use case requires them

If a later slice adds contact-field reveal, export, copy, or drill-in actions,
those actions must be separately audited before implementation.

## Audit Requirements

M18 read-only CRM must audit relationship detail reads unconditionally. CRM is a
new searchable relationship surface even when it reuses data already visible in
operational queues, so relationship detail access must fail closed with an audit
event before implementation ships.

M18 must add:

- `crm.relationship_detail.viewed`

M18 tests must prove that detail reads record this audit event with actor user
ID, target user ID, target role, and safe context. The audit payload must not
store raw PHI, contact field values, full addresses, request-event metadata,
payment provider metadata, payment notes, or audit details.

M19 mutable CRM must add explicit audit actions before implementation:

- `crm.note.created`
- `crm.note.updated`
- `crm.note.deleted`
- `crm.follow_up.created`
- `crm.follow_up.updated`
- `crm.follow_up.closed`

Future contact-field reveal, export, copy, and drill-in actions must add their
own audit actions before shipping, including at least:

- `crm.contact_field.revealed`
- `crm.relationship_export.created`
- `crm.timeline_drill_in.viewed`

Audit details must store only safe context: actor, target type, target ID,
action, timestamp, and coarse reason. Audit payloads must not store raw PHI,
clinical text, secrets, session data, card data, or unredacted free text.

## M18 First Implementation Slice

M18 should build a read-only CRM operator view:

- `/admin/crm`: searchable read-only contact list for patients and referral
  partners
- `/admin/crm/[userId]`: read-only relationship detail with profile summary,
  partner organization/status when applicable, request counts, latest requests,
  exception/payment flags, and redacted location/request context

M18 should not include:

- nurse CRM directory or nurse CRM detail pages
- notes
- tags
- follow-ups
- exports
- bulk actions
- profile editing
- role changes
- request reassignment
- payment mutation
- new CRM tables, unless a query-performance index is required

Expected implementation ownership:

- `packages/contracts/src/crm.ts` for response schemas
- `packages/domain-admin-ops/src/crm-directory.ts` for read projections
- `apps/web/src/app/admin/crm` for admin UI
- `apps/web/src/app/api/admin/crm` only if the UI needs client-side search
- `apps/web/src/app/admin/layout.tsx` for the CRM nav item

Required M18 tests:

- contract schema tests for CRM DTOs
- DB-backed projection tests for list, detail, search, sorting, limits, partner
  joins, request summaries, and redaction
- DB-backed audit tests proving relationship detail reads write
  `crm.relationship_detail.viewed`
- admin API authorization tests if API routes are added
- UI smoke for admin navigation, search, and detail drill-in
- access tests proving patient, nurse, and referral partner actors cannot reach
  `/admin/crm`

Nurse CRM summaries remain part of the broader CRM v1 definition, but they are
out of scope for M18. The existing credential queue and nurse detail pages
remain the operator surfaces for nurse work until a later CRM slice explicitly
adds nurse relationship requirements, audit behavior, and tests.

## M19 Notes and Follow-Ups Boundary

M19 is the first slice allowed to introduce CRM-owned mutable records.

Before implementation, M19 must decide whether to introduce a new
`@nurseconnect/domain-crm` package. That package is justified only when it owns
CRM-specific invariants such as note content policy, follow-up lifecycle,
assignment/closure rules, retention rules, and audit semantics.

CRM notes must be non-clinical operator notes only. The UI and contracts must
warn operators not to enter diagnoses, assessment text, clinical care plans,
credentials, secrets, payment card data, or unnecessary PHI.

## Launch Relationship

CRM is not a v1.0.0 launch prerequisite.

M17 Controlled Launch Dry Run and Decision Ledger remains the next
launch-blocking milestone after M16. M18 and M19 can proceed only after M16 is
approved and M17 evidence confirms controlled launch readiness.

## Acceptance Criteria

- Define CRM as an admin-only relationship projection, not a new source of
  truth.
- Assign M18 read-only projections to `@nurseconnect/domain-admin-ops`.
- Defer `@nurseconnect/domain-crm` until M19 mutable notes/follow-ups create
  true CRM-owned invariants.
- Identify the allowed CRM actors and disallowed uses.
- Map source-of-truth ownership for users, patients, partners, nurses,
  requests, visits, payments, audit, and ops.
- Define PII, PHI, payment, audit, credential, and session redaction rules.
- Define required CRM audit actions for M19 and future reveal/export actions.
- Define the M18 first implementation slice and its required tests.
- Preserve M17 as the next launch-blocking milestone before CRM implementation.
