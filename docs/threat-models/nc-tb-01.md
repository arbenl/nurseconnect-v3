# NC-TB-01 Threat Model

## Slice

NC-TB-01 / codex/tenant-expand.

## Scope

Default organization/branch/jurisdiction bootstrap, nullable `organization_id`
and care-site scope expand, default backfill, invariant tests, and rollback
evidence for the tenant-owned data plane.

Non-scope: production RLS enforcement, non-null constraints, outbox, CQRS
repair, PHI read audit, field encryption, retention, erasure, and UI changes.

## Assets

- PHI-bearing request, patient, visit, assignment, and workflow rows.
- Payment authorization and nurse payout evidence.
- Default organization, branch, and jurisdiction seed identifiers.
- Sanitized migration, backfill, reconciliation, and rollback evidence.

## Trust Boundaries

- Migration and backfill code writes tenant ownership across PHI-adjacent rows.
- Runtime write paths must populate default ownership during the migration
  window without trusting client-submitted tenant fields.
- Evidence artifacts cross from database execution into PR/reviewer records and
  must not contain PHI, secrets, credentials, or production identifiers.
- RLS remains non-enforcing until later observe/enforce slices.

## STRIDE Findings

- Spoofing: client-supplied tenant or care-site identifiers must not be accepted.
- Tampering: relationship-owned rows must derive ownership from parent request
  chains, not blanket defaults when parent ownership exists.
- Repudiation: backfill and rollback runs need sanitized, reviewable evidence.
- Information disclosure: logs and reconciliation output must never include PHI.
- Denial of service: indexes/backfill chunks need lock and statement timeouts.
- Elevation of privilege: default ownership must not be mistaken for final RLS
  authorization or platform-admin bypass.

## Residual Risk

This slice prepares tenant columns but does not prove tenant isolation. Mixed
audit, payout/export, nurse supply, service-area, and referral contexts remain
blocked until their explicit ownership decisions land. Full PHI lifecycle
controls remain NC-E5 work. `branch_id` is the accepted NC-TB-01 care-site
column; any later `facility_id` rename needs reviewed tracker and contract
amendments before migration generation.

## Verification

- Gate manifest requires this threat model for `ent-tm`.
- Data-lifecycle evidence records table inclusion/defer decisions.
- Performance evidence records migration/backfill availability controls.
- Seed-twice, zero-null, relationship consistency, and rollback evidence are
  required before PR.
- `tenant:isolation` readiness/guard output must be recorded with disposition.
- PR #114 merged at `48eb6fab9bd83712245716998c0cdf9bd6bbe196` after
  reviewer/security disposition, required remote checks, and thread audit passed.
