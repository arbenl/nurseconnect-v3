# NC-TB-01 Pause Dispositions

Date: 2026-07-07
Status: Accepted for NC-TB-01 implementation

## Branch Authority

NC-TB-01 implements `branch_id` as the care-site resource column. The current
trackers name `branch_id`, and the tenant-isolation contract has been amended
to match. `facility_id` remains product vocabulary or future alias work unless
a reviewed tracker and contract amendment changes the column before migration.

## Admin Audit Logs

`admin_audit_logs` stays deferred in NC-TB-01. The tenant-isolation contract
keeps it in `deferredTenantTables`, and this slice does not add a nullable
`organization_id` to mixed platform/tenant audit rows. A future audit slice must
choose split tenant/platform audit tables or an explicit scope discriminator
before staging restrictive RLS tests include admin activity.

## Referral Sequencing

`service_requests.referral_partner_id -> users.id` is preserved as platform
referral evidence in NC-TB-01. Backfill must not derive tenant ownership from
`users` or `referral_partners`; request rows receive default tenant/branch
ownership from the single-tenant bootstrap path. Retargeting referral ownership
belongs to later CRM/referral boundary work.

## Nurse Context

`nurses` remains a platform supply identity table in NC-TB-01. This slice does
not add `nurses.organization_id`. Tenant/facility/jurisdiction-specific nurse
eligibility, consent, credential trust, assignment participation, PHI exposure,
and audit evidence must be represented by explicit tenant nurse context rows in
a successor slice, not by duplicating tenant columns on the platform nurse
profile.

## Service Request Events

`service_request_events` is included only after
`docs/evidence/nc-tb-01/service-request-events-meta.md` classifies current
`meta` key shapes and confirms the ownership backfill emits sanitized evidence.

## Payouts

`nurse_payouts` can receive nullable `organization_id` in NC-TB-01 only as
request-derived ownership evidence. Ledger/export scope, tenant-safe reporting,
and RLS enforcement remain later financial-boundary work before non-null or
enforce mode.
