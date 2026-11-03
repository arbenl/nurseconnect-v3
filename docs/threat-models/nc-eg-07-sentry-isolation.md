# NC-EG-07 Sentry Isolation Threat Model

## Slice

NC-EG-07 / codex/sentry-config-isolation-delivery, standard implementation
from promoted main b3772a83d712bcb1efbc8fa309738d01d54c9106. Tier 3 gate infrastructure.

## Scope

Sentry advisory, shared validated client/target resolver, trusted collector,
regression tests and operational documentation. No application telemetry, DSN,
auth policy, tenant enforcement, schema, clinical workflow or deployment changes.

## Assets

Sentry credential, NurseConnect project identity, PHI-safe evidence and honest gates.

## Trust Boundaries

Repo-owned target config supplies the approved HTTPS origin, routing slugs and
immutable IDs. Ambient generic values never choose a destination. Dedicated
overrides must match; generic mismatches fail in CI and are surfaced as key names
only outside CI. One client builds URLs and attaches credentials after validation.
Project metadata must match both IDs and slugs before the issue-list request.

## STRIDE Findings

- Spoofing/tampering: reject alternate identities, origins and recreated IDs
  before credential transmission or before querying issues, as applicable.
- Disclosure: prohibit redirects; bound responses to 1 MiB; emit a fresh evidence
  allowlist, never issue objects, provider errors or credential values.
- Downgrade: CI true/TRUE/1 rejects advisory override. Strict missing credentials,
  nonempty results, HTTP failures, malformed responses and timeouts remain failures.
- Denial of service: two sequential requests, each with a 15-second timeout;
  no automatic retries or alternate-target/credential fallback after failure.

## Residual Risk

The existing account token can have wider provider permissions than this client
uses. A dedicated token is future hardening, not a required new credential here.
The provider's existing project-issues endpoint is deprecated but remains the
approved narrow project route; migration is separate work. No enterprise-wide
privacy or tenant-isolation completion is claimed.03A/03B remain held.

## Verification

Focused CLI/client tests cover pinning, pollution, CI modes, missing/blank token,
identity mismatch, HTTP/transport/shape failures and synthetic payload leakage.
Obtain a timestamped strict live count-only receipt for the pinned NurseConnect
project. Static, senior/pool/model review, required gates, native review and CI
remain mandatory; no gate source or threshold is relaxed.
