# NC-TB-02 Tenant Observe Design

Date: 2026-07-13
Status: Proposed
Slice: `NC-TB-02 / tenant-observe`
Implementation branch: `codex/tenant-observe`
Risk tier: Tier 3

## Purpose

Make exported application database queries against the NC-TB tenant-owned data
plane observable and move current flows through transaction-local tenant context.
Export a PHI-safe count and prove E2E zero; this alone cannot authorize NC-TB-03.

## Authority and Constraints

- `current-program.md` and `current-tracker.md` promote NC-TB-02 after NC-TB-01.
- The tracker requires guard mode in CI, a visible count, and full-E2E zero.
- ADR-001 and the backfill plan require transaction-local observe-before-enforce.
- NC-TB-03 owns `NOT NULL`, composite tenant FKs, RLS, roles, and deny proofs.
- Telemetry contains no SQL, parameters, tenant IDs, PHI, paths, or exception text.

## Design

### Database-boundary observer and executor proof

Add a Drizzle `Logger` in `@nurseconnect/database`. It classifies exact tenant
table tokens in memory and immediately discards text/parameters. Without a
tenant-bound executor it records one sanitized event:

```text
tenant_scope_violation { boundary, reason, operation, tables, count }
```

Tracked tables are `branches`, `org_memberships`, `service_requests`, `patients`,
`assignments`, `visits`, `service_request_events`, `payment_authorizations`, and
`nurse_payouts`. `organizations` is platform boundary; NC-TB-01 deferrals remain.

Tenant context stores the organization and allowlisted boundary. A deep global
database facade checks current context at invocation time, including detached
methods and prebuilt query builders, so provenance does not depend on ALS alone.
The global `db` facade records `wrong_executor` when used inside a tenant
transaction, closing the cross-connection false zero. Unscoped tracked queries
record `missing_context`; a negative integration test proves exactly one event.
Boundary IDs are fixed enum values, never stacks, paths, or caller strings.

The observer exports a process snapshot and test-only JSONL sink. Production is
observe-only: exact counts plus deduplicated bounded warnings. Harness sink
failure is fatal. SQL and parameters never leave the classifier.

### Tenant-context adoption

Tracked server boundaries call `withDefaultTenantContext(boundary, callback)`
with the NC-TB-01 default organization and pass its transaction through helpers.
Nested contexts remain rejected; touched global imports become explicit
executors. Context access is observability-only, never auth or GUC proof.

Adoption covers requests, payments, partner flows, admin queues, visits, and
membership authorization. Platform-only paths remain outside unless mixed with
a tracked tenant table.

### CI-visible zero signal

Playwright config creates an exclusive nonce/path before server start, injects
both via `webServer.env`, and forbids reuse. The observer appends bounded
single-write JSONL records using append mode: `ready`, first `tracked_query_seen`,
and each violation. Each record carries the run nonce and an observer-instance
nonce. There is no buffered sink to flush. Teardown strictly parses and
aggregates all instances, writes a sanitized summary under the uploaded
Playwright artifact tree, and prints `tenant_scope_violations=<count>`.

Missing, malformed, wrong-run, unlived, or nonzero evidence fails. Unit tests
cover interleaved instances, an unavailable filesystem sink, injected sink
failure, and a controlled violation. Full API and UI runs exercise multi-instance
append and each produce an independent receipt.

CI `quality` runs `pnpm tenant:isolation -- --mode guard --source drizzle` after
lint. Guard output prints the observation contract and zero-count requirement
while preserving existing schema/scenario readiness decisions. PR CI runs the
full API and full UI projects (not only smoke); PR Finalizer waits for both.
NC-TB-03 still owns enforce-mode scenario completion.

### Classifier contract

The classifier masks SQL strings and line/block comments in one pass, tokenizes
bounded identifier/context tokens, and recognizes tracked tables only
after `FROM`, `JOIN`, `UPDATE`, `INSERT INTO`, or `DELETE FROM`. It supports
quoted, case-normalized, schema-qualified, aliased, CTE-body, and multi-table
queries while excluding tracked-name literals, comments, substrings, and CTE
aliases. Tests assert the 256 KiB cap and adversarial structural cases; they do
not claim an asymptotic scaling benchmark.

### Out-of-band inventory and NC-TB-03 hold

Add a PHI-safe inventory classifying non-app paths as tenant/platform/test-only,
blocked, or retired. The Drizzle observer does not claim their coverage.

Closing NC-TB-02 requires local/PR E2E zero. Promoting NC-TB-03 to enforcement
also requires the rollout plan's representative 14-day zero window, restrictive
staging/two-tenant proof, and resolved payout/export/support classifications.
Until then NC-TB-03 is selected next but held at its external promotion gate.

## File Plan

- database observer, context accessor, exports, and focused unit tests
- shared web default-tenant adapter plus scoped server-boundary adoption
- Playwright observation config/teardown and focused evidence parser tests
- tenant-isolation guard output/count contract and regression tests
- checked database-access inventory and NC-TB-03 promotion hold
- NC-TB-02 design, threat model, data-lifecycle, performance, and gate manifest

Every new source, script, config, workflow, or test file remains at most 150
lines. Existing oversized harness/test files will be extended only through new
helpers or test files.

## Threat, Lifecycle, and Performance Decisions

- Spoofing/tampering: tenant context comes from the server-owned default
  organization, never request input; transaction handles are propagated.
- Disclosure: telemetry is allowlisted and never serializes SQL or parameters.
- Availability: masking is one-pass and structural relation scans have a capped
  input; production warnings deduplicate; exact file writes are harness-only.
- Lifecycle: the signal contains operational metadata only, with no PHI or
  tenant identifier; CI artifacts use existing short Playwright retention.
- Performance: bounded masking/tokenization plus structural relation scans per
  Drizzle query; no database round trip beyond the existing context set/assert.

## Stop Conditions

- Any tracked application flow cannot obtain server-owned tenant context.
- Detection requires SQL/parameter persistence or PHI-bearing telemetry.
- Full E2E reports a nonzero signal that cannot be resolved within this slice.
- Adoption would require an NC-TB-03 RLS/constraint change or expand a deferred
  tenant-ownership decision.
- Required reviewer, security, ent-gate, or remote CI evidence is not green.

## Verification

- focused observer/classifier, provenance, Playwright evidence, and harness tests
- database context integration and pooled-connection cleanup tests
- focused affected domain/web tests
- `pnpm tenant:isolation -- --mode guard --source drizzle`
- `pnpm gate:e2e-api` and `pnpm --filter web test:e2e:ui` with required observer
  liveness, plus public-only UI-smoke with an explicit inactive-observer allowance;
  all three retain a visible zero-count summary
- `pnpm architecture:boundaries` and `pnpm modularity:guard`
- same-run `verify-slice`, static review, reviewer/security disposition, Codex
  senior review, required gates, and all protected remote checks
