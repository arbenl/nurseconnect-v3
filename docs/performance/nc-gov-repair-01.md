# NC-EG-09 / NC-GOV-REPAIR-01 Performance

## Scope

No product query, database, API latency or background job changes. Policy checks
operate on one fixed 24-file set. Historical tests use disposable local Git clones.
Sentry collection makes exactly two requests, with no pagination or retries.
Each uses a total 15-second AbortSignal deadline across connect/headers/body
and a streamed 1 MiB cap (at most 30 seconds for both requests);
issue sample limit is one, because any unresolved issue fails strict acceptance.

## Verification

Run focused unit/context tests and record actual duration in the external packet.
No product performance claim is inferred. Mandatory full gates remain outstanding
until exact owner adoption; no thresholds or required checks are reduced.
