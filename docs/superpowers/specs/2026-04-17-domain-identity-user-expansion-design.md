# NurseConnect Domain Identity User Expansion
Date: 2026-04-17
Status: Proposed
Scope: Enterprise architecture slice after merged Step 5 (`@nurseconnect/domain-admin-ops`)

## Purpose
Define how `@nurseconnect/domain-identity` expands to own the `User` aggregate logic that still lives in `apps/web`, without turning identity into a framework-coupled package or collapsing nurse-specific concerns back into user state.

This is a user/identity expansion spec.

It is not:
- a Better-Auth integration rewrite
- a nurse-profile extraction
- an onboarding UI redesign
- a new `domain-users` package proposal

## Executive Summary
`@nurseconnect/domain-identity` should expand so it owns:
- domain-user upsert/bootstrap from auth session
- profile update rules
- derived profile-completion rules
- `/api/me` user projection shaping
- admin role-change policy

`apps/web` should remain the delivery and orchestration layer:
- Better-Auth and session/header integration
- `NextResponse`, route parsing, and HTTP formatting
- route-level authorization via `requireRole(...)`
- admin audit writes
- transaction composition
- page, hook, and onboarding UI state

This keeps the `User` aggregate coherent in one domain package while preserving the same separation already established for `domain-request`, `domain-dispatch`, and `domain-admin-ops`.

## Current User Surface
- `apps/web/src/lib/user-service.ts`
- `apps/web/src/app/api/me/route.ts`
- `apps/web/src/app/api/me/profile/route.ts`
- `apps/web/src/app/api/admin/users/[id]/role/route.ts`
- `apps/web/src/server/auth/portal-access.ts`
- `apps/web/src/hooks/use-user-profile.ts`
- `apps/web/src/types/me.ts`

Related but explicitly out of scope:
Business logic for these areas does not move in this slice. If a file below is touched, it should only be for minimal adapter/bootstrap import rewiring needed to point user bootstrap flows at `@nurseconnect/domain-identity`.
- `apps/web/src/app/api/profile/route.ts` deprecated legacy profile/session route
- `apps/web/src/app/api/me/nurse/route.ts` out of scope for nurse/business logic changes; may be touched only for adapter/bootstrap import rewiring
- `apps/web/src/app/api/me/become-nurse/route.ts` out of scope for nurse/business logic changes; may be touched only for adapter/bootstrap import rewiring
- `apps/web/src/lib/nurse-record.ts`
- `apps/web/src/server/admin/audit.ts`
- onboarding and dashboard profile pages

## Core Decisions

### 1. Expand the existing identity package, do not create `domain-users`
This slice should extend `@nurseconnect/domain-identity` instead of introducing a new package.

Why:
- the `User` aggregate is already identity-owned
- auth/session policy is already established in the package
- the remaining stranded logic is user/profile/role policy, not a separate bounded context yet
- creating a new package now would add naming churn without buying a cleaner dependency graph

This slice should therefore deepen the existing package rather than fan out another top-level workspace package.

### 2. Distinguish persisted profile completion from derived portal readiness
The current code has two related but different concepts:
- `users.profileCompletedAt`
- derived `profileComplete` returned by `/api/me` and used by portal access

They should remain distinct.

`profileCompletedAt` represents base identity-profile completion on the `users` table:
- first name
- last name
- phone
- city

Derived `profileComplete` is a read-side concept:
- for non-nurse users, it matches base identity completeness
- for nurses, it additionally requires nurse readiness fields such as `licenseNumber` and `specialization`

This slice should make that distinction explicit:
- `profile-policy.ts` owns the persisted base-profile completion rule
- `me-projection.ts` owns the derived read-side completion rule
- `apps/web/src/server/auth/portal-access.ts` should reuse the same derived completion helper instead of carrying its own duplicate logic

### 3. Domain user bootstrap/upsert moves into identity
The logic that ensures an authenticated user exists in the domain database belongs in identity.

That includes:
- `ensureDomainUserFromSession(...)`
- `maybeBootstrapFirstAdmin(...)`

These functions should move out of `apps/web/src/lib/user-service.ts` and into `@nurseconnect/domain-identity`.

They should remain:
- independent of Better-Auth internals
- driven by plain input data from the app adapter
- directly backed by `@nurseconnect/database` during initial extraction

### 4. Profile update policy belongs in the domain package
`/api/me/profile` currently owns validation, normalization, base completion logic, and the database patch shape directly in the route.

This slice should move that policy into `profile-policy.ts`.

Responsibilities:
- validate profile updates
- normalize profile values as needed
- decide whether the base profile is complete
- return the user patch that should be persisted

The route stays responsible for:
- session/auth resolution
- request parsing
- executing the database update
- formatting the HTTP response

### 5. `/me` projection shaping belongs in the domain package
`/api/me` currently assembles:
- domain user
- optional nurse profile
- derived completion state
- final response payload shape

This shaping should move into `me-projection.ts`.

Important boundary:
- nurse data is an input to the projection, not identity-owned state
- `apps/web` continues to fetch the optional nurse snapshot
- `me-projection.ts` accepts the domain user plus optional nurse snapshot and returns the shaped user payload

This keeps identity from taking ownership of nurse reads or writes while still centralizing the application-facing self projection.

### 6. Admin role change should return pure side-effect descriptors
Admin role mutation belongs to identity policy, but admin audit remains an app concern.

So `admin-role-policy.ts` should:
- validate role changes
- return unchanged results when no mutation is needed
- return the user patch plus side-effect descriptors when a change is allowed

The initial side-effect contract should be explicit:

```ts
export type IdentitySideEffect =
  | {
      type: "admin-audit";
      action: "user.role.changed";
      targetUserId: string;
      details: {
        previousRole: "admin" | "nurse" | "patient";
        nextRole: "admin" | "nurse" | "patient";
        targetEmail: string | null;
      };
    };
```

The route in `apps/web` should then:
- open the transaction
- persist the user patch
- fulfill the returned `admin-audit` side effect via `recordAdminAction(...)`

This keeps role invariants in the domain and audit in the application layer.

### 7. Manual role change does not create or mutate nurse profile state
The current admin role route can set `role: "nurse"` directly, but it does not create a nurse record.

This slice should preserve that boundary.

That means:
- admin role change is a user-role mutation only
- it does not create a nurse profile
- it does not update nurse availability
- it does not fill nurse credential fields

Those concerns stay in `@nurseconnect/domain-nurse`.

If the product later needs a stronger nurse-promotion workflow, that should be designed deliberately as a cross-domain flow rather than being smuggled into identity.

### 8. `apps/web` keeps auth, audit, and HTTP responsibilities
After extraction, `apps/web` should still own:
- `getSession(...)`
- `requireRole(...)`
- `NextResponse`
- request/response parsing and formatting
- transaction composition
- admin audit writes
- hooks and page composition

This keeps `@nurseconnect/domain-identity` framework-agnostic and reusable.

## Target Package Shape

```text
packages/domain-identity/
  src/
    index.ts
    errors.ts
    domain-user.ts
    profile-policy.ts
    me-projection.ts
    admin-role-policy.ts
    portal-access-policy.ts
    require-role.ts
```

Notes:
- `portal-access-policy.ts` and `require-role.ts` already exist and remain part of the package
- `me-projection.ts` should export the derived profile-completion helper that `apps/web/src/server/auth/portal-access.ts` reuses
- a nested `admin/` subfolder can be introduced later, but it is not required for this slice

## Package Responsibilities

### `domain-user.ts`
Owns the basic `User` aggregate bootstrap rules.

Responsibilities:
- upsert a domain user from auth-session input
- preserve default role behavior for new users
- bootstrap first-admin behavior through the allowlist rule
- keep this logic independent of Better-Auth-specific types

This module may continue to depend directly on `@nurseconnect/database` during initial extraction.

### `profile-policy.ts`
Owns base identity-profile update rules.

Responsibilities:
- validate the profile patch
- normalize the accepted fields
- decide whether the base profile is complete
- return the `users` table patch to persist

This module owns the persisted completion decision for `profileCompletedAt`.

It does not:
- read nurse state
- shape the `/me` payload
- execute the database mutation itself

### `me-projection.ts`
Owns the self-profile read projection.

Responsibilities:
- shape the app-facing `/me` user payload
- compute derived `profileComplete`
- combine base user data with optional nurse snapshot

The same derived completion helper should also be used by `apps/web/src/server/auth/portal-access.ts` so onboarding redirect policy and `/api/me` stay consistent.

This module does not:
- fetch session state
- fetch nurse data itself
- write any database rows

### `admin-role-policy.ts`
Owns admin role-change policy.

Responsibilities:
- validate allowed role changes
- no-op when the requested role matches the current one
- return the user patch to persist
- return `IdentitySideEffect[]` for admin audit fulfillment

This module does not:
- execute the update
- write audit rows
- create nurse records when changing a user into `role: "nurse"`

### `errors.ts`
Centralizes identity/user domain errors for this slice.

Initial candidates:
- `UserNotFoundError`
- `ProfileValidationError`
- `RoleChangeValidationError`

These errors should be reusable from both app adapters and package tests.

## Dependencies
The intended dependency direction is:

`apps/web -> domain-identity -> database`

Notes:
- `domain-identity` does not need a dependency on `@nurseconnect/domain-nurse` for this slice if nurse data is passed in as projection input
- `domain-identity` may continue to depend directly on `@nurseconnect/database` during initial extraction
- `apps/web/src/types/me.ts` can remain the frontend contract for now; the package should return shape-compatible data without forcing a frontend type move in the same slice

## What Stays In `apps/web`
- `apps/web/src/app/api/me/route.ts`
- `apps/web/src/app/api/me/profile/route.ts`
- `apps/web/src/app/api/admin/users/[id]/role/route.ts`
- `apps/web/src/server/auth/portal-access.ts`
- `apps/web/src/hooks/use-user-profile.ts`
- `apps/web/src/types/me.ts`
- `apps/web/src/server/admin/audit.ts`
- `apps/web/src/app/api/profile/route.ts`

These modules become thinner adapters where appropriate, but they continue to own transport, auth integration, audit execution, and UI behavior.

## What Must Stay Out
This slice should explicitly avoid:
- no Better-Auth extraction into the domain package
- no `next/server` or `NextResponse` imports in `@nurseconnect/domain-identity`
- no nurse-profile mutation or nurse-record creation in identity
- no onboarding page or dashboard-profile UI refactor
- no new `domain-users` package
- no attempt to redesign the deprecated `/api/profile` legacy route as part of this extraction

## Testing Strategy
The extraction should preserve three layers of verification:

1. Package unit tests
- domain-user bootstrap behavior
- first-admin allowlist behavior
- profile update validation and patch shaping
- derived completion for patient vs nurse projections
- role-change policy and returned side-effect descriptors

2. Existing DB integration and route tests
- `/api/me`
- `/api/me/profile`
- `/api/admin/users/[id]/role`
- portal-access behavior that depends on completion state

3. Existing UI and onboarding verification
- onboarding redirect behavior
- dashboard/profile flows that read `profileComplete`
- admin users table role mutation flow

## Risks

### Risk 1: profile completion stays duplicated
The current code already duplicates derived completion logic between `/api/me` and `portal-access.ts`.

Mitigation:
- make `me-projection.ts` the single home of derived completion logic
- update `portal-access.ts` to use that helper

### Risk 2: identity absorbs nurse concerns by accident
Because `/api/me` includes nurse profile data, it is easy to let identity start owning nurse rules.

Mitigation:
- nurse data must remain an input to the projection
- no nurse mutation logic moves into this slice

### Risk 3: role change silently grows into a cross-domain workflow
Changing a user to `role: "nurse"` could tempt the implementation to auto-create nurse rows or credential records.

Mitigation:
- explicitly preserve current behavior
- keep role change as a user patch plus audit side effect only

## Non-Goals
- no new workspace package for users
- no nurse promotion workflow redesign
- no automatic nurse record creation on admin role change
- no Better-Auth configuration changes
- no UI hook redesign beyond adapting to unchanged route payloads
- no movement of deprecated `/api/profile` into the package

## Outcome
This slice succeeds when:
- user/profile/admin-role domain logic no longer lives directly in routes or app-local utility files
- `@nurseconnect/domain-identity` becomes the authoritative home of `User` aggregate policy
- `apps/web` becomes thinner around `/api/me`, `/api/me/profile`, and admin role mutation
- nurse-specific concerns stay inside `@nurseconnect/domain-nurse`

That gives NurseConnect a clean next step after `domain-admin-ops` without opening a new package prematurely or re-mixing user and nurse responsibilities.
