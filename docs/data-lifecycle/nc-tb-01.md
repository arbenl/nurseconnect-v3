# NC-TB-01 Data Lifecycle Evidence

## Scope

NC-TB-01 adds tenant ownership metadata to existing single-tenant rows. It does
not change retention, erasure, encryption, consent, read-audit, or production
RLS enforcement.

Included tables:

- `service_requests`
- `patients`
- `assignments`
- `visits`
- `payment_authorizations`
- `nurse_payouts`
- `service_request_events` after mandatory `meta` classification

Deferred tables:

- `admin_audit_logs`; NC-TB-01 accepts the existing contract deferral and does
  not add a tenant column before a split-table or scope-discriminator design
- `nurses`; platform nurse profile rows stay non-tenant in this slice, and
  tenant/facility/jurisdiction-specific nurse context moves to successor work
- `nurse_locations` and `service_areas` until supply, jurisdiction, and
  operating-market ownership are modeled
- `referral_partners`, `users`, and auth tables remain platform/identity
  evidence unless a reviewed sequencing decision amends that boundary

## Verification

- `docs/evidence/nc-tb-01/pre-backfill-audit.md` records row-count gates,
  relationship checks, zero-null reconciliation, and rollback/down-path proof.
- Orphan checks cover `visits -> assignments -> service_requests`,
  `service_request_events -> service_requests`, and
  `payment_authorizations -> service_requests`.
- `docs/evidence/nc-tb-01/service-request-events-meta.md` records all current
  event types, key shapes, PHI status, and masking decisions.
- `docs/evidence/nc-tb-01/pause-dispositions.md` records audit-log, referral,
  nurse context, and branch authority dispositions.
- Backfill evidence is sanitized and must not include PHI, secrets,
  credentials, patient data, or production identifiers.
- Zero-null and relationship consistency checks must pass for every included
  table before PR, including care-site scope on request/visit rows.
- Rollback/down-path rehearsal must define FK/index drop order, seed handling,
  and nullable-column ignore/remove proof on a disposable database.
- PR #114 merged at `48eb6fab9bd83712245716998c0cdf9bd6bbe196`; the exact
  reverse-order 0018/0017 rollback rehearsal passed on `nurseconnect_test`.
