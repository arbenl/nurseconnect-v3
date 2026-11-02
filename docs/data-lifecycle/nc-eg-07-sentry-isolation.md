# NC-EG-07 Sentry Evidence Lifecycle

## Scope

No schema, clinical data, application capture, retention rule or vendor changes.
The client reads project metadata and at most five unresolved issue samples
(the trusted collector requests one). Provider objects remain transient.

Runtime credentials are selected inside the shared client: dedicated NC token
preferred, existing account token allowed when no dedicated token is available.
Blank tokens are missing. An authentication failure never triggers credential
or destination fallback. No DSN or token belongs in tracked config or artifacts.

Advisory JSON contains exactly schemaVersion, status, checkedAt, identity and
unresolvedSampleCount. Identity is copied from the approved pin, never a provider
object. JSON uses mode0600 on creation. The existing artifact filename is retained;
its contents are now an operational record rather than an issue array. Markdown
and CLI output contain only fixed statuses, pinned identity, count and drift key
names. The trusted collector preserves its head/base and target-digest contract.

Current run outputs are regenerated from the allowlist. Historical run roots are
not read or purged. Existing local/CI operational-artifact retention applies;
this slice does not introduce a PHI archive or an erasure/compliance claim.

## Verification

Synthetic issue/title/metadata/token/error sentinels must never occur in persisted
JSON, markdown, stdout or stderr. Invalid identity must fail before credential
use; metadata mismatch must fail before the issue-list request. Strict live
evidence retains no raw provider response. Full gates and native review remain
required; 03A/03B and all tenant external prerequisites remain held.
