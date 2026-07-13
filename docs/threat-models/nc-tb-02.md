# NC-TB-02 Threat Model

## Slice

NC-TB-02 / tenant-observe.

## Scope

Observe application queries against tenant-owned tables, prove the actual
transaction-bound executor, and export PHI-safe zero/nonzero evidence. RLS,
non-null constraints, and two-tenant enforcement remain NC-TB-03.

## Assets

- PHI-bearing request, patient, visit, assignment, and event rows.
- Payment authorization and payout trace rows.
- Sanitized warning, JSONL, summary, reviewer, and CI evidence.

## Trust Boundaries

- The application Drizzle boundary, pooled connections, tenant ALS, and the
  transaction-local PostgreSQL GUC.

## STRIDE Findings

- Spoofing: the server-owned default organization enters `withTenantContext`;
  request input cannot choose the tenant.
- Tampering/elevation: ALS alone is insufficient. The global database facade
  counts use of the wrong executor while a tenant transaction is active.
- Repudiation: run- and instance-bound ready/liveness/violation records aggregate
  into a retained exact-count summary.
- Disclosure: the classifier discards SQL/parameters in memory; events contain
  only allowlisted boundary, reason, operation, table, and count fields.
- Denial of service: query classification is capped at 256 KiB and production
  warnings deduplicate; exact synchronous JSONL writes exist only in the E2E
  harness. No strict asymptotic complexity claim is made.

## Residual Risk

Direct clients, migrations, support SQL, analytics, exports, and future jobs are
outside the Drizzle observer and are classified separately. E2E zero is not
authorization proof and does not permit NC-TB-03 until the 14-day representative
window and restrictive staging/two-tenant gates pass.

## Verification

Classifier adversarial tests, wrong-executor DB proof, fail-closed evidence
parsing, API/full-UI zero receipts, security review, and required ent-gates.
