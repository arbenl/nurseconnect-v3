# NC-TB-01 Reviewer Disposition

Date: 2026-07-13
Run root: `tmp/multi-agent/verify-slice/verify-slice-20260713T143528Z-c719ad`

## Local Reviewer Receipts

All six planned local lanes produced receipts under `reviews/subagents/`.

| Lane | Original result | Disposition |
| --- | --- | --- |
| Security | One `MUST_FIX` | Fixed: canonical branch ID/ownership/attributes are validated before use; negative DB test added. |
| Architecture | One `MUST_FIX` | Fixed: payment-to-request ownership resolution moved to the application composition boundary; payment domain persists proved context without importing request tables. |
| QA | One `MUST_FIX`, one `SHOULD_FIX` | Fixed: checked backfill runner integration covers every table, batching, idempotence, check-only failure, and mismatches; event fixture now includes organization ownership. |
| Operations | Two `MUST_FIX` | Fixed: reconciliation covers non-null parent/default/branch mismatches; rollout runbook defines mutation hold, order, second reconciliation, and rollback/HOLD triggers. |
| Contracts | One `MUST_FIX` | Fixed by the same fail-closed mismatch plan and checked integration coverage. |
| Performance | No `MUST_FIX`, one `SHOULD_FIX` | Technically rejected as a code change; documented acceptance below. |

## Performance Advisory Disposition

The request-event parent lookup remains. It is a primary-key read inside the
existing transaction and the request domain owns both the parent and event
tables. Passing a caller-held organization UUID would remove the fail-closed
derivation and introduce a forgeable or stale tenant-ownership input without a
non-forgeable proof type. `docs/performance/nc-tb-01.md` now records this
bounded query cost and the invariant any future optimization must preserve.

## Additional Security Audit Fixes

The required diff-scoped audit reproduced and fixed two operator-boundary
defects: migration acceptance of a non-canonical fixed organization identity,
and loss of PostgreSQL URI TLS/channel-binding settings in the backfill runner.
Focused clean-migration/identity tests passed 27/27; the transport suite passed
3/3 including execution of the real runner with a disposable `psql` stand-in.
The finalized security report contains zero surviving findings.

## Model Review Status

Claude Sonnet 4.6 produced no review output before timeout. Gemini 3.1 Pro High
was quota/model-route blocked. Neither route is counted as approval. The Tier 3
debate therefore completed no model lanes and is advisory evidence only.

## Codex Senior Review Disposition

The first final-commit receipt used Codex `gpt-5.5` against
`origin/main...e78cc3af`; its packaging observation was resolved by committing
all referenced modules. The refreshed Codex `gpt-5.6-sol` receipt identified two
real P1s: the default branch jurisdiction was incorrectly seeded as US, and
backfill applied before auditing pseudo-tenant signals. Both are fixed in
`93096804`: the canonical seed is Kosovo (`XK` / `Pristina`) across migration,
runtime, and helpers, and the runner now blocks before updates when referral,
service-area, or operator-group signals are ambiguous. The next Sol review
also required resumable preflight semantics, co-committed audit evidence, and
a payout-to-assigned-nurse mismatch guard; these are fixed in the current
follow-up: null ownership is ignored only during preflight, each batch appends
an `admin_audit_logs` evidence row in the same transaction, and payout nurse
identity is checked before mutation. The final follow-up also rejects
partially owned children when their parent is still null, records audit evidence
for the migration/runtime default-branch seed, uses the branded
`OrganizationId` for default request creation, and blocks payouts whose parent
has no assigned nurse. The final receipt additionally identified the
organization seed as an unaudited domain mutation; both migration and runtime
organization bootstrap now co-commit the sanitized audit row with the insert.
The follow-up also rejected payouts when the completed request has no assigned
nurse, strips internal tenant routing keys from every request API response,
and preserves libpq timeout, routing, and `options` URI parameters in the
backfill runner. Unknown backfill flags are rejected before any database
connection or mutation.

The senior review also questioned the required tenant-isolation guard because
NC-TB-01 intentionally has no executable two-tenant assertion refs. This is a
technical rejection, not an ignored finding: the versioned contract and
`tenant-isolation-guard-refs.md` explicitly define
`ADVISORY_PASS_PENDING_SCENARIOS` as the expected NC-TB-01 guard result, while
NC-TB-03 owns enforce-mode assertions. Guard mode still fails closed for unsafe
partial schema, invalid refs, and missing boundary tables; the required gate
therefore preserves the existing promotion trigger without claiming tenant
isolation evidence.

The exact-head review at `3ecb12b1` then found that structurally valid payment
request context could name a different existing organization or user. This P1
is fixed with database-enforced composite ownership: authorization rows must
match the request ID, organization, and patient; payout rows must match the
request ID, organization, and assigned nurse. A regression constructs the
previously forgeable context and proves the insert fails without leaving a
payment row. The migration applies cleanly from an empty test database and all
six payment DB tests pass.

A final post-fix senior receipt is required before push; quota, MCP OAuth, and
shutdown errors remain operational evidence, never approval.
