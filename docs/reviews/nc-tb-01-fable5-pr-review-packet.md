# NC-TB-01 Fable 5 PR Review Packet

Date: 2026-07-07
Status: advisory model-review packet
Slice: `NC-TB-01 / tenant-expand`
Branch: `codex/tenant-expand`
Authority: repo docs, source, tests, and gates override this packet and any
model response.

## Privacy Boundary

Do not include PHI, secrets, credentials, raw production logs, patient details,
payment identifiers, clinician identifiers, or production tenant identifiers in
the prompt or response. Review only sanitized repository evidence and local
disposable test evidence.

## Slice Goal

Prepare the current single-tenant NurseConnect data plane for later tenant
observe/enforce work by adding deterministic default organization and branch
ownership, nullable tenant columns, bounded backfill behavior, and proof that
new writes carry default ownership without changing production query behavior.

## Current Non-Goals

NC-TB-01 does not authorize RLS enforcement, `NOT NULL` tenant constraints,
composite tenant FKs, two-tenant abuse fixtures, production PHI read audit,
retention/erasure changes, commercial model changes, or route behavior changes.
Those remain successor work.

## Evidence To Review

- `AGENTS.md`
- `docs/plans/current-program.md`
- `docs/plans/current-tracker.md`
- `docs/plans/ENTERPRISE_UPGRADE_TRACKER.md`
- `docs/plans/nc-tb-01-tenant-expand-design.md`
- `docs/threat-models/nc-tb-01.md`
- `docs/data-lifecycle/nc-tb-01.md`
- `docs/performance/nc-tb-01.md`
- `docs/evidence/nc-tb-01/pre-backfill-audit.md`
- `docs/evidence/nc-tb-01/service-request-events-meta.md`
- `docs/evidence/nc-tb-01/pause-dispositions.md`
- `docs/evidence/nc-tb-01/tenant-isolation-guard-refs.md`
- `config/tenant-isolation-contract.json`
- `packages/database/drizzle/0017_tenant_expand.sql`
- `packages/domain-request/src/request-events.ts`
- `packages/domain-payments/src/payment-trace.ts`
- `apps/web/src/server/requests/allocate-request.ts`

## Review Questions

1. Is the expand-only boundary coherent for a healthcare marketplace that will
   later need enterprise tenant isolation, PHI protection, and auditability?
2. Does the migration avoid premature RLS enforcement while still preventing
   new orphaned tenant ownership in request-event and payment trace writes?
3. Are the pre-backfill, zero-null, relationship, rollback, and bounded backfill
   evidence sufficient for a launch-sized database, with clear stop conditions?
4. Are any payment, dispatch, support, incident, audit-log, or nurse credential
   trust risks being hidden by the default-tenant bootstrap?
5. Are the deferred items correctly separated into launch-critical versus
   enterprise-scale successor slices?
6. What MUST_FIX items, if any, should block PR before deterministic gates?
7. What SHOULD_FIX items should become follow-up candidates for `NC-TB-*`,
   `NC-E3-*`, `NC-CQ-*`, or `NC-E5-*` work?

## Required Output Shape

Return concise markdown with:

- `Verdict`: `READY`, `READY WITH SHOULD_FIX`, or `NOT READY`
- `MUST_FIX`: numbered blockers or `none`
- `SHOULD_FIX`: numbered non-blocking improvements or `none`
- `Launch vs Enterprise`: bullets separating immediate launch safety from
  enterprise-scale requirements
- `Evidence Gaps`: missing evidence paths or `none`
- `Successor Slice Candidates`: suggested `NC-TB-*` or other tracker names

Model output is advisory. It cannot override repo authority, current tracker
state, required gates, human reviewer receipts, or PR Finalizer.
