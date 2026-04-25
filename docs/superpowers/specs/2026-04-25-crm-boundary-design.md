# M16: CRM Boundary Design

Date: 2026-04-25
Status: Done - merged via PR #68
Scope: CRM actors, data ownership, privacy guardrails, audit actions, and first
implementation slice
Reviewer: verify-slice reviewer pool covering security, architecture, QA, and
ops; Copilot reviewed the PR and generated no comments

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

M18 will deliver the first read-only CRM operator projection. A separate
`@nurseconnect/domain-crm` package is deferred until CRM owns mutable business
records, starting with M19 notes and follow-ups.

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

Patients cannot initiate CRM access.

### Referral Partner

Referral partners are CRM subjects and external demand actors. Their own portal
remains scoped to partner-submitted requests.

Referral partners cannot view cross-partner CRM data.

### Nurse

Nurses are CRM subjects only where operator relationship context is needed.
Credential and availability source-of-truth remains in the nurse domain.

Nurses are not CRM users at M18.

## Source-of-Truth Ownership

| Area | Existing owner | CRM may | CRM must not |
| --- | --- | --- | --- |
| Users, roles, profile fields | [`@nurseconnect/domain-identity`](../../../packages/domain-identity) and `users` | Read minimum-necessary identity fields, role, operational status, created/updated timestamps, and entity IDs used for navigation. | Own user records, edit profile fields, change roles, expose session cookies, auth tokens, raw auth account rows, or raw session data. |
| Patient request history | [`@nurseconnect/domain-request`](../../../packages/domain-request) and [`@nurseconnect/domain-visit`](../../../packages/domain-visit) | Summarize request counts, latest request states, request type/source, broad care type, assignment state, and safe timeline hints. | Own patient lifecycle state, duplicate request/visit records, expose diagnoses, assessment text, free-text clinical documentation, raw request-event `meta`, or clinical records. |
| Referral partners | [`@nurseconnect/domain-referral`](../../../packages/domain-referral) | Show partner organization, partner status, referral demand summaries, and partner-scoped relationship context. | Mutate partner profiles, show cross-partner data, or bypass existing partner visibility rules. |
| Nurses and credentials | [`@nurseconnect/domain-nurse`](../../../packages/domain-nurse) | Show credential status, jurisdiction, expiration date, availability summary, and later nurse relationship summaries after a dedicated CRM slice. | Reveal license numbers, mutate credential state, or treat nurses as CRM users at M18. |
| Dispatch and service areas | [`@nurseconnect/domain-dispatch`](../../../packages/domain-dispatch) and service-area admin code | Show dispatch relationship context, service-area labels, and coarse location hints. | Assign or reassign requests, reveal exact latitude/longitude, or own service-area data. |
| Payments and payouts | [`@nurseconnect/domain-payments`](../../../packages/domain-payments) | Show status/count/gap flags and payment follow-up indicators. | Execute payment operations, settlement, reimbursement, or payout actions; expose card or bank data, provider references, notes, failure reasons, or raw provider metadata. |
| Admin audit and ops | [`@nurseconnect/platform-telemetry`](../../../packages/platform-telemetry) and [`@nurseconnect/domain-admin-ops`](../../../packages/domain-admin-ops) | Audit CRM reads and writes and show coarse exception/payment follow-up flags. | Expose raw audit/security metadata or raw audit details as relationship content. |

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

Redaction failures must fail closed. A missing field, unexpected field shape, or
redaction error returns `null`, omits the field, or blocks the projection; it
must not return the raw value.

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

Audit payloads must follow this safe shape:

```ts
{
  actor_id: string;
  target_id: string;
  target_role: "patient" | "referral_partner" | "nurse";
  action: "crm.relationship_detail.viewed";
  timestamp: string;
  context_label: string;
}
```

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

M18 must build a read-only CRM operator view:

- `/admin/crm`: searchable read-only contact list for patients and referral
  partners
- `/admin/crm/[userId]`: read-only relationship detail with profile summary,
  partner organization/status when applicable, request counts, latest requests,
  exception/payment flags, and redacted location/request context

M18 must not include:

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

- planned `packages/contracts/src/crm.ts` for response schemas
- planned `packages/domain-admin-ops/src/crm-directory.ts` in
  [`@nurseconnect/domain-admin-ops`](../../../packages/domain-admin-ops) for
  read projections
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

M18 tests pass only when:

- contract tests prove DTOs omit disallowed raw fields
- DB-backed projection tests prove license numbers, full addresses, exact
  coordinates, raw payment provider references, payment notes, payment failure
  reasons, request-event metadata, and audit details are absent from all CRM
  projections
- audit tests prove every detail read writes
  `crm.relationship_detail.viewed` with actor user ID, target user ID, target
  role, timestamp, and safe context
- authorization tests prove only admin actors can access CRM routes

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
launch-blocking milestone after M16. Do not create the M18 implementation branch
until M17 evidence exists and confirms controlled launch readiness.

See the locked sequence in
[M15 Program Roadmap Lock](2026-04-24-program-roadmap-lock-design.md).

## Known Deferrals

- Contact-field reveal, export, copy, and drill-in actions require separate
  audit actions before implementation.
- `@nurseconnect/domain-crm` remains deferred until M19 introduces mutable
  CRM-owned notes and follow-ups.
- Nurse CRM directory and nurse CRM detail pages remain deferred until a later
  CRM slice defines nurse relationship requirements, audit behavior, and tests.

## Acceptance Criteria

- CRM is defined as an admin-only relationship projection, not a new source of
  truth.
- M18 read-only projections are assigned to
  [`@nurseconnect/domain-admin-ops`](../../../packages/domain-admin-ops).
- `@nurseconnect/domain-crm` is deferred until M19 mutable notes/follow-ups
  create true CRM-owned invariants.
- Allowed CRM actors and disallowed uses are explicit.
- Source-of-truth ownership is mapped for users, patients, partners, nurses,
  requests, visits, payments, audit, and ops.
- PII, PHI, payment, audit, credential, and session redaction rules are
  explicit and fail closed.
- Required CRM audit actions are defined for M18, M19, and future reveal/export
  actions.
- The M18 first implementation slice and required pass criteria are explicit.
- M17 remains the next launch-blocking milestone before CRM implementation.
