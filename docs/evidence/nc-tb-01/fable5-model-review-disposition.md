# NC-TB-01 Fable 5 Model Review Disposition

Date: 2026-07-07
Status: advisory disposition
Run root: `tmp/multi-agent/verify-slice/verify-slice-20260707T122224Z-d3485e`

## Scope

Fable 5 was invoked through the repo model-review route `claude48` with
`CLAUDE_48_REVIEW_MODEL=claude-fable-5`. The model-review packet was sanitized
and did not include PHI, secrets, production identifiers, patient data, raw
logs, or credentials. Model output is advisory and does not override repo
authority, deterministic tests, subagent reviewers, senior review, or gates.

## Accepted And Fixed

- Added `branches` to `config/tenant-isolation-contract.json` as a tenant-owned
  care-site boundary with `organization_id`, while keeping RLS deferred to
  `NC-TB-03`.
- Updated `apps/web/src/server/requests/request-actions.db.test.ts` so direct
  DB fixtures create tenant-owned parent `service_requests` before appending
  request events.
- Clarified rollback evidence in
  `docs/evidence/nc-tb-01/pre-backfill-audit.md` and
  `docs/plans/nc-tb-01-tenant-expand-design.md`: post-release rollback must
  pair application rollback with any later schema cleanup.
- Moved data backfill out of the transactional Drizzle migration into
  `scripts/backfill-tenant-ownership.mjs`, which commits each table batch
  separately and emits zero-null/orphan reconciliation output.
- Sanitized the backfill runner so `DATABASE_URL` is not passed on the `psql`
  command line and arbitrary error messages are not printed.

## Technically Rejected Or Stale

- `payment_authorizations` missing from the tenant contract: stale. The current
  contract includes `payment_authorizations`, and the focused tenant-isolation
  harness passes.
- Corrupted tenant-isolation test/import claims: stale. The current test file
  imports valid Node modules and passes 13 tests.
- Inline notification side effect inside `allocate-request.ts`: stale. The
  current file appends request events in-transaction but does not call a
  notification side effect.
- Optional payment ownership: stale. `recordPaymentAuthorizationTrace` and
  `recordNursePayoutTrace` both require a parent request with `organizationId`
  and throw on missing tenant ownership.
- Type-check failures and missing evidence docs: stale. Workspace type-check
  passed locally, and the cited evidence docs exist in this worktree.
- Cross-domain `resolveDefaultOrganizationId` transaction coupling: stale.
  The current request-event and payment-trace write paths derive ownership from
  the parent request, not from a cross-domain default-organization resolver.

## Residual Advisory Items

- Keep non-concurrent index creation tied to the row-count stop condition or a
  reviewed maintenance window.
- Preserve existing request ownership once multi-tenant creation paths exist;
  NC-TB-01 only stamps default ownership for new single-tenant launch writes.
- Carry default organization/branch uniqueness and observe-mode null-write
  telemetry into successor `NC-TB-*` work.
