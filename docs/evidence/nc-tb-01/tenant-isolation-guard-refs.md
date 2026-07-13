# NC-TB-01 Tenant Isolation Scenario Handoff

Date: 2026-07-07
Status: Handoff only; not executable assertion evidence

This note records the scenario targets NC-TB-01 makes possible by adding
nullable tenant ownership columns. It does not satisfy the NC-E1-04
tenant-isolation scenario assertions. The contract keeps these assertion refs
empty until NC-TB-03 adds executable two-tenant abuse tests, RLS policies, and
enforce-mode pass evidence.

Expected NC-TB-01 status is `ADVISORY_PASS_PENDING_SCENARIOS`: guard mode may
pass schema readiness, while enforce mode must still fail until NC-TB-03.

## tenant_a_cannot_read_tenant_b

NC-TB-01 adds nullable tenant ownership columns so this scenario has a concrete
schema target. Enforcement remains NC-TB-03.

## tenant_a_cannot_write_tenant_b

NC-TB-01 adds ownership columns and default runtime writes. Wrong-tenant write
rejection remains NC-TB-03 when non-null columns and policies land.

## wrong_tenant_negative_cases

NC-TB-01 records expected ownership columns on request, patient, visit, payment,
and event tables. Negative behavior assertions remain NC-TB-03.

## shared_nurse_no_cross_tenant_inference

NC-TB-01 keeps `nurses` platform-scoped and does not add `nurses.organization_id`.
Explicit tenant nurse context remains successor work before enforcement.

## platform_admin_explicit_audited_access

NC-TB-01 defers `admin_audit_logs` tenant ownership through the contract's
`deferredTenantTables` entry. Platform-admin audited access remains future
audit/RLS work before enforcement.
