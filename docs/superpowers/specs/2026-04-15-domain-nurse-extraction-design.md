# NurseConnect Domain Nurse Extraction

Date: 2026-04-15
Status: Proposed
Scope: Enterprise architecture Step 2 after merged Step 0 and Step 1

## Purpose

Define the `@nurseconnect/domain-nurse` extraction boundary so nurse business rules move out of `apps/web` without pulling request-state concerns into the nurse domain too early.

This is an extraction spec, not a feature spec. The goal is to preserve current behavior while making nurse policy the authoritative concern of a dedicated package.

## Executive Summary

`@nurseconnect/domain-nurse` should own nurse-domain truth:

- credential lifecycle and status transitions
- nurse record creation and lookup
- nurse availability policy that depends only on nurse state
- nurse operating state, including location updates and throttling
- nurse-specific validation and domain errors

`apps/web` should remain the delivery and composition layer:

- request parsing and HTTP responses
- Better Auth and route auth
- telemetry and audit call wiring
- cross-domain checks against request state, especially the active-visit guard in `/api/me/nurse`

This is a hybrid extraction boundary by design. It avoids coupling nurse logic to `service_requests` before the request and dispatch seams are deliberately redesigned.

## Current Nurse Surface

The nurse domain is currently spread across these files:

- `apps/web/src/server/admin/nurse-credentials.ts`
- `apps/web/src/server/nurse-location/update-my-location.ts`
- `apps/web/src/lib/nurse-record.ts`
- `apps/web/src/app/api/me/nurse/route.ts`
- `apps/web/src/app/api/me/become-nurse/route.ts`
- `apps/web/src/app/api/admin/nurses/route.ts`
- `apps/web/src/app/api/admin/nurses/[id]/verify/route.ts`
- `apps/web/src/app/api/admin/nurses/[id]/reject/route.ts`
- `apps/web/src/app/api/admin/nurses/[id]/suspend/route.ts`
- `apps/web/src/app/api/admin/nurses/[id]/availability/route.ts`
- `packages/contracts/src/nurse-credential.ts`
- `packages/database/src/schema/nurses.ts`
- `packages/database/src/schema/nurse-locations.ts`

The strongest nurse-domain invariants already present are:

- only verified nurses with a non-expired license can self-mark available
- credential verification promotes the user role to `nurse`
- rejection and suspension force availability off
- location updates are throttled and require a nurse actor plus a nurse profile
- applicant and nurse lifecycle status is modeled explicitly on the `nurses` table

## Core Decision

### 1. Hybrid Boundary

`@nurseconnect/domain-nurse` will own nurse-domain policy and DB-backed nurse use cases, but it will not absorb cross-domain request-state logic in this step.

The most important example is `/api/me/nurse`:

- nurse-domain checks:
  - user must be a nurse
  - nurse profile must exist
  - nurse status must be `verified`
  - license must not be expired
- request-domain check:
  - the nurse cannot set `isAvailable = true` while an active request is assigned

That active-request check stays outside `domain-nurse` for now because it depends on `service_requests` state and belongs with request/dispatch policy.

### 2. Keep App Adapters Thin

Existing routes stay in `apps/web`, but their responsibilities narrow to:

- authenticate and authorize
- parse request payloads
- call cross-domain guards where needed
- invoke `domain-nurse` use cases
- format HTTP responses and telemetry

### 3. Preserve Direct `@nurseconnect/database` Access During Extraction

As with Step 0 and Step 1, the new package may import from `@nurseconnect/database` directly during this extraction. Repository ports are not required yet.

## Target Package Shape

```text
packages/domain-nurse/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts
    errors.ts
    availability-policy.ts
    credential-lifecycle.ts
    location-state.ts
    nurse-record.ts
```

## Package Responsibilities

### `errors.ts`

Owns typed nurse-domain errors such as:

- `NurseCredentialValidationError`
- `NurseAvailabilityError`
- `NurseLocationForbiddenError`

These errors are thrown by domain logic and translated into HTTP responses by app routes.

### `availability-policy.ts`

Owns nurse-state-only availability checks.

Examples:

- verified status required
- expired licenses cannot be made available
- rejected, suspended, expired, or non-verified states cannot be made available

This module must not query `service_requests`. It only decides based on nurse state.

### `credential-lifecycle.ts`

Owns DB-backed nurse credential workflows:

- `submitNurseApplication`
- `listNurseCredentials`
- `getNurseCredentialCounts`
- `getNurseCredentialById`
- `verifyNurseCredential`
- `rejectNurseCredential`
- `suspendNurseCredential`

This module continues to use `recordAdminAction` from `@nurseconnect/platform-telemetry/admin-audit`.

Although the current implementation lives under `apps/web/src/server/admin`, the logic is nurse-domain logic, not admin-domain logic.

### `location-state.ts`

Owns `updateMyNurseLocation` and the nurse location throttle rule.

Reason:

- location update is a nurse operating-state behavior
- dispatch consumes the resulting state later, but does not own the update policy

### `nurse-record.ts`

Owns:

- `getNurseByUserId`
- `createNurseRecord`

This keeps nurse record lifecycle separate from identity projection.

## What Stays In `apps/web`

The following remain app-layer adapters:

- `apps/web/src/app/api/me/nurse/route.ts`
- `apps/web/src/app/api/me/become-nurse/route.ts`
- `apps/web/src/app/api/admin/nurses/route.ts`
- `apps/web/src/app/api/admin/nurses/[id]/verify/route.ts`
- `apps/web/src/app/api/admin/nurses/[id]/reject/route.ts`
- `apps/web/src/app/api/admin/nurses/[id]/suspend/route.ts`
- `apps/web/src/app/api/admin/nurses/[id]/availability/route.ts`

These routes continue to own:

- `requireRole` / session access
- `NextResponse`
- telemetry
- cross-domain request-state checks
- URL and payload handling

## Explicit Non-Goals

This extraction must not:

- move the active-visit check from `/api/me/nurse` into `domain-nurse`
- redesign the admin availability override semantics
- extract nurse UI components
- refactor request allocation or reassignment
- add new user-visible behavior

## Testing Strategy

Use two layers:

### 1. Package-local unit tests

For pure nurse policy:

- availability policy
- typed domain errors

### 2. Existing app-level DB/API tests

For DB-backed nurse behaviors:

- `apps/web/src/server/nurse-location/update-my-location.db.test.ts`
- `apps/web/src/server/auth/user-service.db.test.ts`
- `apps/web/tests/e2e-api/admin-nurse-credentials.api.e2e.ts`
- `apps/web/tests/e2e-api/nurse.api.e2e.ts`

These should be updated to import the extracted package where appropriate, proving the behavior remains stable after the move.

That includes applicant submission through `POST /api/me/become-nurse`, not only admin review and self-availability.

## Risks

### 1. Cross-Domain Leakage

If `domain-nurse` starts querying `service_requests` directly, the nurse package will become an early grab-bag instead of a clean domain boundary.

### 2. Audit/Telemetry Regression

Credential lifecycle logic currently records admin audit actions. Those calls must continue to flow through the shared telemetry package, not drift back into app-local clones.

### 3. Route Behavior Drift

The admin and self-service nurse routes already have good API coverage. The extraction must preserve exact behavior, especially:

- applicant stays `patient` until verification
- applicant submission remains idempotent on the `nurses` row
- verification promotes role
- invalid license expiry is rejected
- rejected and suspended nurses are forced offline
- self-availability still rejects active assigned visits

## Success Criteria

This extraction is successful when:

- `@nurseconnect/domain-nurse` becomes the authoritative home for nurse business rules
- `apps/web` nurse routes become transport adapters
- no behavior changes are introduced in nurse credential, location, or availability flows
- the active-visit guard remains outside the nurse package until request/dispatch redesign is deliberate
