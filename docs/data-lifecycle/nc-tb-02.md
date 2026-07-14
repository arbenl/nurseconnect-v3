# NC-TB-02 Data Lifecycle Evidence

## Scope

NC-TB-02 adds operational metadata only. It does not copy, retain, erase,
encrypt, or change access to patient, clinical, payment, or identity data.

The in-process signal contains an allowlisted boundary ID, reason, operation,
tracked table names, and numeric count. It never persists SQL, parameters,
tenant, patient, or domain identifiers, stack traces, file paths, exception
text, PHI, credentials, or production row data. Random run and observer-instance
UUIDs are retained only as opaque harness correlation nonces.

The JSONL sink is enabled only by the Playwright harness. Each invocation uses
an exclusive random run path under the existing Playwright artifact tree.
Teardown emits a sanitized aggregate summary; CI retains both under the existing
short Playwright artifact policy. Local artifacts remain ignored workspace
output and are never committed.

The checked access inventory records out-of-band paths without production data.
No lifecycle assertion from NC-TB-01 is relaxed. Support, analytics/export, and
payout decisions remain mandatory before NC-TB-03 enforcement.

## Verification

Observer unit tests prove sanitized records and sink failure behavior. Full API
and UI teardown receipts prove the retained aggregate is present and zero.

## Closeout

PR #116 merged at `430dc4b48ea075b850921db56ffd87206e2a1ae5`.
The final API and UI smoke receipts reported `tenant_scope_violations=0`; the
full remote matrix and required lifecycle gates passed. This closeout does not
promote enforcement or relax any deferred access classification.
