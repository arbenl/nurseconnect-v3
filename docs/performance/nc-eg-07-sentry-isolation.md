# NC-EG-07 Sentry Client Performance

## Scope

Operational gate code only: no application request path, bundle, SQL or worker
change. The existing zero-unresolved threshold remains unchanged.

## Verification

The shared client performs at most two sequential HTTPS requests: metadata,
then unresolved issue samples only after immutable identity validation. Each
request has a 15-second AbortSignal timeout and a 1 MiB response limit, bounding
network wait to approximately 30 seconds plus bounded parsing/cleanup. There are
no automatic retries. Invalid configuration or missing credentials sends zero
requests; bad metadata sends no issue request. Return/artifact size depends on
the fixed identity and an integer count, not the issue-payload size.

Deterministic fixture tests assert request counts, no redirects, timeout signals,
oversized/malformed rejection and fixed output shape. Live zero-count evidence
supplements tests; it is not a production latency benchmark or p95 claim. All
existing performance gates/budgets remain unchanged.
