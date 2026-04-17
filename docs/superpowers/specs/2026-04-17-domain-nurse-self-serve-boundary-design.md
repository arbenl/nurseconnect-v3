# NurseConnect Domain Nurse Self-Serve Boundary Completion
Date: 2026-04-17
Status: Proposed
Scope: Post-Step-7 residual seam cleanup after merged Step 7 (`@nurseconnect/domain-visit`)

## Purpose
Define the remaining nurse self-serve boundary so self-application submission and self-availability mutation become authoritative package-owned policy inside `@nurseconnect/domain-nurse`.

This is not a new top-level domain package.

It is a boundary-completion spec for the already-merged `domain-nurse` slice.

It is not:
- a rework of admin nurse credential lifecycle
- a reopening of `domain-request` or `domain-dispatch`
- a redesign of nurse location writes
- a `domain-patient` proposal
- a full dashboard UX redesign

## Executive Summary
`@nurseconnect/domain-nurse` already owns nurse credential lifecycle, location state, and availability policy, but two self-serve routes still leak important policy back into `apps/web`:
- `/api/me/become-nurse`
- `/api/me/nurse`

The remaining business risk is not transport shape. It is supply integrity:
- a self-serve application submission should not be able to push an already-verified nurse back to `submitted`
- nurse self-availability should be validated and persisted through package-owned policy, not app-local direct table updates

The package should gain a self-serve surface for:
- `submitOwnNurseApplication(...)`
- `setMyAvailability(...)`

`apps/web` should remain responsible for:
- auth/session resolution
- HTTP request parsing and response formatting
- cross-domain active-visit conflict checks
- route telemetry

`/api/me/location` should stay out of this slice because it is already the reference pattern for a correct thin adapter over `@nurseconnect/domain-nurse`.

`/api/profile` should be treated as a legacy compatibility adapter only.

## Current Surface
- `apps/web/src/app/api/me/become-nurse/route.ts`
- `apps/web/src/app/api/me/nurse/route.ts`
- `apps/web/src/app/api/profile/route.ts`
- `apps/web/src/components/dashboard/become-nurse-card.tsx`
- `apps/web/src/components/dashboard/nurse-status-card.tsx`
- `apps/web/src/components/dashboard/nurse-application-status-card.tsx`
- `apps/web/tests/e2e-api/nurse.api.e2e.ts`

Related but explicitly out of scope:
- `apps/web/src/app/api/me/location/route.ts`
- `apps/web/src/app/api/admin/nurses/*`
- `packages/domain-nurse/src/location-state.ts`
- `packages/domain-nurse/src/credential-lifecycle.ts` admin verification, rejection, and suspension flows
- `packages/domain-dispatch/*`
- `packages/domain-visit/*`

## Core Decisions

### 1. This is a `domain-nurse` completion, not a new Step 8 domain
The remaining seam belongs to the existing nurse domain.

Why:
- self-application submission is nurse credential state
- self-availability mutation is nurse supply state
- neither concern justifies a new package

This work should be treated as post-Step-7 boundary completion inside `@nurseconnect/domain-nurse`, not as a brand-new domain extraction.

### 2. Verified supply must not be demoted by self-serve submission
The current self-serve route calls `submitNurseApplication(...)`, which uses a broad upsert path.

That means UI gating currently protects the flow more than the domain policy does.

This is not acceptable as a durable business boundary.

The package-owned self-serve API must enforce:
- a verified nurse cannot be pushed back to `submitted` through `/api/me/become-nurse`
- self-serve submission cannot overwrite admin-owned nurse states

For this step, the business-model answer is:
- **no**, already-verified nurses should not trigger automatic application resubmission through the self-serve route

If NurseConnect later needs renewal or relicensing self-service, that should be a dedicated renewal workflow, not a hidden reuse of `become-nurse`.

### 3. Self-serve application submission must be state-gated
The self-serve path should not be a generic “upsert any nurse row” primitive.

`submitOwnNurseApplication(...)` should:
- create a new submitted application when no nurse row exists
- allow idempotent resubmission only for explicitly in-progress self-serve states
- reject protected states with a domain error

Recommended treatment for this step:
- allow:
  - no existing record
  - `draft`
  - `submitted`
- reject:
  - `under_review`
  - `verified`
  - `rejected`
  - `suspended`
  - `expired`
  - `renewal_pending`

Rationale:
- `under_review` is already in an admin-owned process
- `verified` must protect active supply integrity
- `rejected` already tells the nurse to contact support before reapplying
- `suspended` is explicitly admin-controlled
- `expired` and `renewal_pending` imply a renewal workflow that this route does not model yet

This preserves current business safety without inventing renewal behavior prematurely.

### 4. Self-availability mutation belongs in the package
`/api/me/nurse` still mixes:
- auth/session handling
- request parsing
- nurse lookup
- nurse-state validation
- direct DB mutation
- cross-domain active-visit conflict handling

The intrinsic nurse-side part should move into `@nurseconnect/domain-nurse`.

`setMyAvailability(...)` should own:
- finding the nurse record for the acting user
- failing when no nurse profile exists
- enforcing verified/unexpired eligibility through `assertCanSetSelfAvailability(...)`
- persisting `nurses.isAvailable`

This keeps the supply-state mutation inside the domain package.

### 5. Active-visit conflict stays in `apps/web`
The business rule “a nurse with an active assigned visit cannot mark themselves available” spans domains:
- nurse supply state
- request/visit state

That cross-domain read should stay composed in `apps/web` for now.

So the route should:
1. authenticate and resolve the acting user
2. if availability is being turned on, query active assignment state
3. return HTTP `409` if an active visit exists
4. otherwise call `setMyAvailability(...)`

This keeps `domain-nurse` from reaching into request tables for a cross-boundary conflict that is already handled cleanly in the app adapter.

### 6. No new `NurseStateConflictError` is needed in this step
The intrinsic nurse-domain failures should keep using `NurseAvailabilityError` and existing validation errors.

Why:
- the `409 Conflict` in this flow is not a pure nurse-domain rule
- it comes from the app-layer active-visit composition

So for this step:
- `domain-nurse` throws:
  - `NurseAvailabilityError`
  - `NurseCredentialValidationError`
- `apps/web` maps the active-visit conflict to HTTP `409`

If a later slice moves active-assignment conflicts into a single package-owned nurse supply service, a dedicated conflict error can be reconsidered then.

### 7. `/api/me/location` stays out
`/api/me/location` is already the model route for the desired shape:
- app-layer auth adapter
- domain-owned validation and persistence
- no direct app-local table mutation

This slice should not reopen it.

The spec should explicitly cite `/api/me/location` as the “already-correct reference pattern” for nurse self-serve transport adapters.

### 8. `/api/profile` is legacy compatibility only
`/api/profile` no longer represents the business truth of user profile ownership.

That truth already lives in:
- `@nurseconnect/domain-identity`
- `/api/me`
- `/api/me/profile`

So this route should be documented as:
- legacy
- read-only
- compatibility-only for the diagnostic page

No new business logic should be added there.

## Target Package Shape

```text
packages/domain-nurse/
  src/
    availability-policy.ts
    credential-lifecycle.ts
    self-service.ts
    errors.ts
    index.ts
```

Notes:
- `self-service.ts` is the preferred home for the new self-serve entry points
- existing lower-level helpers may stay where they are if that keeps responsibilities clear
- `index.ts` should expose only the new public self-serve functions plus existing public nurse-domain APIs

## Package Responsibilities

### `self-service.ts`
Owns nurse self-serve application and availability mutation entry points.

Initial responsibilities:
- `submitOwnNurseApplication(...)`
- `setMyAvailability(...)`

This module should become the package surface used by:
- `/api/me/become-nurse`
- `/api/me/nurse`

### `submitOwnNurseApplication(...)`
Owns self-serve nurse application submission policy.

Responsibilities:
- load the current nurse record first
- decide whether self-serve submission is allowed from the current state
- create or update only the allowed in-progress states
- reject protected states through a domain validation error
- preserve the rule that nurse role promotion happens only through admin verification

This function should not:
- silently demote verified supply
- act as a renewal flow
- write admin audit rows

### `setMyAvailability(...)`
Owns intrinsic nurse self-availability mutation.

Responsibilities:
- load the nurse record by acting user ID
- fail clearly when no nurse profile exists
- enforce verified/unexpired nurse eligibility
- update `isAvailable`
- update `updatedAt`

This function should not:
- inspect request or visit tables
- decide active-assignment conflicts
- own route telemetry

### Existing supporting modules
`credential-lifecycle.ts`, `availability-policy.ts`, and `errors.ts` remain valid supporting modules.

The main boundary change is that self-serve route policy should stop calling generic lifecycle internals directly.

## Route Responsibilities

### `/api/me/become-nurse`
Should become a thin transport adapter over `submitOwnNurseApplication(...)`.

It should keep:
- session/auth resolution
- request JSON parsing
- HTTP error mapping
- telemetry

It should stop owning:
- nurse-state transition decisions
- “upsert whatever exists” behavior

### `/api/me/nurse`
Should become a thin transport adapter over `setMyAvailability(...)` plus one app-layer cross-domain check.

It should keep:
- session/auth resolution
- request JSON parsing
- active-visit conflict check
- HTTP `409` mapping for that conflict
- telemetry

It should stop owning:
- direct `nurses` table mutation
- package-owned nurse-state validation sequencing

### `/api/profile`
Should remain:
- read-only
- compatibility-only
- explicitly legacy

This route should not be expanded as part of this slice.

## Domain Error Rules

### `NurseCredentialValidationError`
Use for self-serve application submission failures such as:
- attempting to resubmit from a protected state
- invalid input combinations if the self-serve surface gains them later

Example error direction:
- `Self-service nurse application is not allowed while status is verified`

### `NurseAvailabilityError`
Continue using this for intrinsic nurse availability failures such as:
- not verified
- expired license

### HTTP `409 Conflict`
Keep this in `apps/web` for:
- active assigned visit present while trying to turn availability on

That conflict remains app-composed for this step.

## Dependencies
The intended dependency direction is:

`apps/web -> domain-nurse -> database / contracts / platform-telemetry(admin-only existing lifecycle writes)`

Notes:
- this slice does not add a new top-level package dependency
- self-serve routes should depend on `@nurseconnect/domain-nurse`, not on direct nurse-table writes
- cross-domain active-visit reads remain in `apps/web`

## What Stays In `apps/web`
- `getSession` / `requireRole` / auth helpers
- `NextResponse` and HTTP status mapping
- route telemetry via ops logger
- active-visit conflict query before enabling availability
- legacy `/api/profile` compatibility behavior

## What Must Stay Out
- no reopening of admin nurse verification/rejection/suspension flows
- no change to `/api/me/location` package ownership
- no renewal workflow design in this slice
- no new top-level domain package
- no UI redesign of dashboard nurse cards
- no role-promotion behavior change beyond preventing unsafe self-serve demotion

## Testing Strategy
The slice should preserve three layers of verification:

1. Package tests
- self-serve submission allows only intended statuses
- verified nurse cannot be demoted to `submitted`
- `setMyAvailability(...)` rejects unverified or expired supply

2. Existing API regression coverage
- patient can submit a nurse application
- repeated submission remains idempotent for allowed in-progress states
- submitted applicants cannot toggle availability
- verified nurses can toggle availability
- verified nurses with an active visit still get `409`
- no missing nurse profile is auto-created through `/api/me/nurse`

3. Manual/browser verification
- dashboard applicant flow still works
- verified nurse cannot self-submit back into applicant state through the API
- legacy profile page remains read-only and diagnostic

## Risks

### Risk 1: protected states are still editable through a generic upsert path
Mitigation:
- self-serve state gate before any write
- no blanket `onConflictDoUpdate` for all nurse states

### Risk 2: cross-domain conflict gets pulled into `domain-nurse`
Mitigation:
- keep active-visit conflict composed in `apps/web`
- keep `setMyAvailability(...)` focused on nurse-owned state only

### Risk 3: `/api/profile` becomes a backdoor for new profile logic
Mitigation:
- explicitly freeze it as a compatibility adapter
- route future profile work through `domain-identity`

## Non-Goals
- no `domain-patient` work
- no `domain-referral` work
- no payment-domain work
- no admin self-serve unification
- no nurse renewal product flow
- no migration-sequence renumbering

## Outcome
This slice succeeds when:
- nurse self-serve submission and self-availability mutation are package-owned policies
- verified supply cannot be demoted through self-serve submission
- `/api/me/become-nurse` and `/api/me/nurse` become thinner adapters
- `/api/me/location` remains the already-correct reference pattern
- `/api/profile` is explicitly frozen as legacy compatibility only

That gives NurseConnect a safer nurse supply boundary without inventing a premature new domain package or reopening stable extraction work.
