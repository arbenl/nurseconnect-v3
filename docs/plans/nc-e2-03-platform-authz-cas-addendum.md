---
plan_role: design_addendum
status: accepted
source_of_truth: false
slice: NC-E2-03
created: 2026-07-04
review_path: docs/reviews/nc-e2-03-platform-authz-design-review.md
---

# NC-E2-03 CAS Addendum

## Purpose

Record the Fable-backed persistence requirement for `NC-E2-03 /
platform-authz` without growing the existing large design document.

## Requirement

`AuthorizedTransition` must be checked twice:

1. At construction, domain policy mints the token only for an allowed
   transition.
2. At persistence, the write path re-checks the token against the locked row
   before mutating `service_requests.status`.

The persistence check must verify:

- request id matches the locked row
- actor id matches the token actor
- expected `from` status matches the current locked status
- transition target matches the authorized target
- tenant/resource context was derived server-side

## Conflict Rule

If the locked row no longer matches the proof, persistence returns a
deterministic conflict. It must not silently overwrite newer state, mint a new
token, or downgrade the failure to a generic success path.

## Implementation Shape

The owning request-domain writer is the persistence authority for request
status transitions. Direct Drizzle/raw SQL status writes outside that authority
require explicit reviewed waivers for migrations, seeds, or tests.

## Falsifiable Evidence

Implementation evidence must include:

- unit test for stale `from` status rejection
- unit test for resource/actor-bound proof shape
- negative type test proving raw objects cannot satisfy the owning domain's
  authorized update helper contract
- boundary guard proving direct Drizzle `.update(serviceRequests).set({ status:
  ... })` and raw SQL `update service_requests set status = ...` production
  write sites fail architecture checks
- same-transaction request event evidence
