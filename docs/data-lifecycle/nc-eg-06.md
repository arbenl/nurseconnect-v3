# NC-EG-06 Data Lifecycle

## Scope

The gate reads git refs, tracker text, a non-secret manifest, file paths, and a
checked authorization record. It writes only local/CI policy evidence.

No PHI, PII, credentials, query content, production data, or tenant identifiers
are processed. Evidence contains mode, commit SHA, branch, path names, verdict,
and sanitized validation errors.

## Verification

Tests assert evidence metadata and fail-closed policy behavior. Existing CI
artifact retention applies; no new persistent data store or erasure path exists.
