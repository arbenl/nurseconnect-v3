# NurseConnect Domain Admin Ops Extraction
Date: 2026-04-16
Status: Proposed
Scope: Enterprise architecture Step 5 after merged Step 4 (`@nurseconnect/domain-dispatch`)

## Purpose
Define the `@nurseconnect/domain-admin-ops` extraction boundary so operator-facing read models and dashboard composition move out of `apps/web` without turning admin functionality into a catch-all mutation domain.

This is a read-model extraction spec. It is not a generic "all admin features" spec.

## Executive Summary
`@nurseconnect/domain-admin-ops` should own admin-facing operational visibility:
- active request queue projection
- triage severity policy and queue ordering
- reassignment activity feed
- ops dashboard aggregation

`apps/web` should remain the delivery and composition layer:
- HTTP transport and auth
- page and route composition
- UI filtering state
- admin audit writes
- dispatch mutations such as reassignment
- the inline admin request-detail summary and timeline reads
- the assignable nurse-candidates query on the admin request-detail page

`domain-admin-ops` is a read-model and operator workflow package only.

It should not absorb:
- user-role mutations
- nurse credential mutations
- request or dispatch write policy
- a generic "admin can do anything" surface

## Current Admin Ops Surface
- `apps/web/src/server/admin/ops-dashboard.ts`
- `apps/web/src/server/admin/activity-feed.ts`
- `apps/web/src/server/requests/admin-active-queue.ts`
- `apps/web/src/server/requests/triage-severity.ts`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/admin/activity/page.tsx`
- `apps/web/src/app/admin/requests/page.tsx`
- `apps/web/src/app/admin/requests/[id]/page.tsx`
- `apps/web/src/app/api/admin/requests/active/route.ts`
- `apps/web/src/app/api/admin/activity/reassignments/route.ts`

Related but explicitly out of scope:
- `apps/web/src/app/api/admin/users/[id]/role/route.ts`
- `apps/web/src/server/requests/admin-reassign.ts`
- `apps/web/src/app/admin/requests/[id]/reassign-panel.tsx`
- `apps/web/src/server/admin/nurse-credentials.ts` re-export facade over `@nurseconnect/domain-nurse`
- `apps/web/src/server/admin/audit.ts`
- `apps/web/src/server/requests/request-events.ts` notification and actor-scoped read APIs

## Core Decisions

### 1. `domain-admin-ops` is read-model only
This package should own operator read models and dashboard composition, not domain mutations.

That means:
- query and shape admin-facing operational data
- compose cross-domain summaries for operator use
- keep mutation policy inside the underlying owning domains

This package should not:
- update `users`
- update `service_requests`
- update `nurses`
- write admin audit rows

### 2. User-role mutation stays in identity
`apps/web/src/app/api/admin/users/[id]/role/route.ts` should not move into `domain-admin-ops`.

Why:
- user-role mutation belongs to the `User` aggregate
- role invariants are identity truth, not operations truth
- moving role changes into admin ops would fracture aggregate ownership and turn admin ops into a god domain

This route should remain an app adapter for a future identity-domain admin use case.

### 3. The package composes across domains, but it does not own them
Admin operations need a cross-domain view of the system.

So `@nurseconnect/domain-admin-ops` reads or composes:
- request queue data
- request event history for operator viewing
- admin audit activity
- nurse credential counts and pending items from `@nurseconnect/domain-nurse`

But this does not change aggregate ownership:
- request write policy stays in `@nurseconnect/domain-request`
- dispatch write policy stays in `@nurseconnect/domain-dispatch`
- nurse write policy stays in `@nurseconnect/domain-nurse`
- user-role mutation stays in identity

### 4. The assignable nurse-candidates query stays out of Step 5
The admin request-detail page currently loads eligible nurse candidates for reassignment.

That query depends on dispatch concerns:
- nurse verification state
- license validity
- availability
- dispatch eligibility

So Step 5 should not pull that query into `domain-admin-ops`.

For now it should stay in `apps/web`.

Later it may move behind a dedicated read helper in `@nurseconnect/domain-dispatch`, but it should not live in admin ops.

### 5. Admin request-detail stays in `apps/web` for Step 5
There is no existing server-side request-detail read module to extract yet.

The current admin request-detail page still composes:
- an inline request-summary query
- an inline assignable nurse-candidates query
- a timeline read through the existing request-events read API

So Step 5 should not invent `request-detail.ts` just to create package surface area.

For now:
- the admin request-detail page stays in `apps/web`
- the inline request summary and timeline composition stay in `apps/web`
- `toLocationHint(...)` should import from `@nurseconnect/domain-admin-ops` after `triage-severity.ts` moves

If the admin detail surface grows enough operator-specific read logic later, it can become its own dedicated module in a later slice.

### 6. `apps/web` keeps auth, routes, and UI state
After extraction, `apps/web` should still own:
- `requirePortalAccessOrRedirect(...)`
- `requireRole("admin")`
- API request parsing and response formatting
- UI filter state and query-param handling
- page-level layout and components
- admin audit writes triggered by mutation routes

This keeps the package focused on business-shaped read models rather than page mechanics.

## Target Package Shape

```plain text
packages/domain-admin-ops/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts
    triage-severity.ts
    active-request-queue.ts
    reassignment-activity-feed.ts
    ops-dashboard.ts
```

Notes:
- this package is projection-first, not route-first
- `errors.ts` is not required initially unless the extracted read models develop their own distinct error set
- read models may continue to depend directly on `@nurseconnect/database` during the initial extraction phase

## Package Responsibilities

### `triage-severity.ts`
Owns queue scoring and ordering policy.

This module moves from `apps/web/src/server/requests/triage-severity.ts` into `@nurseconnect/domain-admin-ops`.

Responsibilities:
- define active request statuses considered "operator-visible"
- define triage severity weights and thresholds
- build queue items from raw request rows
- derive severity bands, wait-time scoring, stale-event bonus, and location hints
- sort queue items deterministically

This module is pure policy/projection logic. It should remain independently unit-testable.

After extraction:
- `active-request-queue.ts` in the package imports it locally
- `apps/web` imports helpers like `toLocationHint(...)` from `@nurseconnect/domain-admin-ops`

### `active-request-queue.ts`
Owns the admin active queue projection.

Responsibilities:
- query active requests and latest event timestamps
- map DB rows into queue items through `triage-severity.ts`
- return the admin queue response shape

This module does not:
- mutate requests
- reassign supply
- make dispatch decisions

This module continues to validate its shaped output with `AdminActiveRequestQueueResponseSchema.parse(...)` from `@nurseconnect/contracts`, preserving current behavior while keeping response-schema ownership in contracts.

### `reassignment-activity-feed.ts`
Owns the merged reassignment activity read model.

Responsibilities:
- read reassignment request events
- read `adminAuditLogs` rows for reassignment actions through `@nurseconnect/database`
- normalize metadata
- merge, sort, and shape the unified activity feed

This module is an operator-facing timeline read model. It does not own the reassignment write path.

It continues to validate its shaped output with `AdminReassignmentActivityResponseSchema.parse(...)` from `@nurseconnect/contracts`, preserving current behavior while keeping response-schema ownership in contracts.

### `ops-dashboard.ts`
Owns top-level operator dashboard composition.

Responsibilities:
- read the active request queue
- read nurse credential counts and pending credential items from `@nurseconnect/domain-nurse`
- read recent reassignment activity
- compute dashboard summary counts and hot-request subsets

This module is a composition surface across domains, but only for operator observability.

## Dependencies
The intended dependency direction is:

`apps/web -> domain-admin-ops -> domain-nurse / domain-request / database / contracts`

Notes:
- `domain-admin-ops` depends on `@nurseconnect/domain-nurse` for credential queue counts and pending items
- `domain-admin-ops` may depend on `@nurseconnect/contracts` for response types
- `domain-admin-ops` may depend directly on `@nurseconnect/database` during initial extraction
- `domain-admin-ops` reads `adminAuditLogs` through `@nurseconnect/database` for the reassignment activity feed; that is a read dependency on the audit table, not a dependency on `@nurseconnect/platform-telemetry`
- `domain-admin-ops` should not become a new owner of request, dispatch, nurse, or identity mutations

## What Stays In `apps/web`
The following remain app-layer modules after Step 5:
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/admin/activity/page.tsx`
- `apps/web/src/app/admin/requests/page.tsx`
- `apps/web/src/app/admin/requests/[id]/page.tsx`
- `apps/web/src/app/api/admin/requests/active/route.ts`
- `apps/web/src/app/api/admin/activity/reassignments/route.ts`
- `apps/web/src/app/api/admin/users/[id]/role/route.ts`
- `apps/web/src/server/requests/admin-reassign.ts`
- `apps/web/src/app/admin/requests/[id]/reassign-panel.tsx`

These modules become thinner adapters over `@nurseconnect/domain-admin-ops` where appropriate, but they continue to own transport, auth, and UI behavior.

## What Must Stay Out
Step 5 should explicitly avoid these moves:
- no user-role mutation extraction into admin ops
- no reassignment mutation extraction into admin ops
- no nurse credential mutation extraction into admin ops
- no assignable nurse-candidates query inside admin ops
- no generic "all admin logic" package scope

Those belong to their owning domains.

## Testing Strategy
The extraction should preserve three layers of verification:

1. Package unit tests
- triage severity scoring
- queue sorting
- activity-feed metadata shaping and merge order
- dashboard summary aggregation

2. Existing DB integration tests
- active request queue behavior
- admin activity feed behavior

3. Existing admin-facing API and page verification
- `/api/admin/requests/active`
- `/api/admin/activity/reassignments`
- admin dashboard page
- admin requests page
- admin activity page
- admin request-detail page

## Risks

### Risk 1: admin ops turns into a dumping ground
If Step 5 starts pulling every admin-only behavior into one package, the boundary fails immediately.

Mitigation:
- keep this package read-model only
- explicitly exclude user-role mutation and reassignment writes

### Risk 2: request-detail scope drifts into dispatch
The admin request-detail page includes a dispatch-oriented nurse-candidates query.

Mitigation:
- keep the request-detail composition in `apps/web` for Step 5
- leave candidate lookup in `apps/web` for now

### Risk 3: dashboard composition becomes too coupled to page concerns
If the package starts owning filters, route params, or JSX-oriented shaping, the extraction will just move app code into a package.

Mitigation:
- keep page filters and UI composition in `apps/web`
- keep package outputs framework-agnostic

## Non-Goals
- no user-role mutation move into admin ops
- no reassignment or dispatch write-policy move into admin ops
- no nurse credential write-policy move into admin ops
- no generic admin catch-all package
- no redesign of the active-queue scoring model
- no new `request-detail.ts` abstraction in Step 5
- no move of notifications or patient/nurse request feeds into admin ops

## Outcome
Step 5 succeeds when:
- admin read models stop living in `apps/web`
- operator dashboard composition becomes a dedicated package concern
- `apps/web` becomes thinner on the admin read side
- identity, nurse, request, and dispatch mutations remain in their owning packages

That gives NurseConnect a clean operations boundary without creating an "admin monolith" package.
