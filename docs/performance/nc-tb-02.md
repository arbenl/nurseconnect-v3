# NC-TB-02 Performance Evidence

## Scope

The Drizzle observer masks strings/comments, tokenizes at most 256 KiB, and
checks a static nine-table set. FROM-list relation scans may revisit bounded
token suffixes, so this evidence does not claim strict linear complexity.
Oversized input fails closed as a violation.

No new database round trip is added beyond the existing transaction-local
`set_config` and assertion when a server boundary enters tenant context. Related
domain operations reuse that transaction handle. The global facade performs a
context lookup on each proxied function invocation, including builder methods.

Production warnings deduplicate by bounded boundary/reason/operation/table key
while the in-memory count remains exact. File writes are disabled in normal
runtime. The E2E harness uses one bounded append call per ready/liveness/
violation record and fails on sink errors, so suppressed output cannot appear as
zero. A passing run writes no per-query records after the first liveness marker.

## Verification

Focused classifier, observer, domain, DB, and Playwright evidence tests plus the
full release/required gates provide regression evidence. The change does not add
schema, index, migration, network, or external-service work.

## Closeout

PR #116 merged at `430dc4b48ea075b850921db56ffd87206e2a1ae5` after
focused performance-sensitive classifier/observer proof, required gates, and
the complete remote matrix passed. No schema, index, migration, network, or
external-service work was added.
