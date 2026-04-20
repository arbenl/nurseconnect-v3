# NurseConnect Referral Partner MVP
Date: 2026-04-17
Status: Proposed
Scope: First launch-defining product slice after the enterprise architecture migration completed through Step 8

## Purpose
Define the first commercially honest Referral Partner MVP for NurseConnect so referral-led demand becomes a real product surface instead of a blueprint aspiration and a couple of intake fields.

This spec is a product and boundary design.

It is:
- the canonical definition of the Referral Partner MVP slice for NurseConnect v1.0.0
- the point where the referral partner actor becomes first-class
- the basis for the next implementation plan and tracker tasks

It is not:
- a white-label partner portal design
- a multi-organization B2B platform design
- a billing or reimbursement workflow
- a new patient-domain extraction
- a full triage or exception-handling redesign

## Executive Summary
NurseConnect now has a stable operating spine:
- verified nurse supply
- shared request creation and lifecycle
- dispatch and reassignment policy
- admin ops read models
- visit and notification reads
- nurse self-serve supply protection

What it still does not have is a real referral-demand surface.

Referral Partner MVP should introduce a narrow external actor who can:
- sign in as an approved partner user
- submit a referral-backed service request into the same shared request system as patient demand
- view only the referrals they originated
- receive a limited, externally safe status projection

NurseConnect should keep operational control:
- admins and ops still triage, validate, and dispatch
- partners do not choose nurses
- partners do not see full internal queue or audit data
- the same request and visit lifecycle still governs fulfillment

This slice is also the point where `@nurseconnect/domain-referral` becomes real.

Why now:
- referral actor model, partner intake ownership, and partner-scoped visibility are now concrete business rules
- those rules are not well-owned by `domain-request`, `domain-identity`, or `apps/web`
- Step 8 finished the migration work needed to add this surface without duplicating business logic

## Why This Is Next
The business thesis already says referral-led demand is the primary launch engine.

Current code reality does not match that thesis yet:
- the role model is still only `admin | nurse | patient`
- canonical routing only knows `/dashboard` and `/admin`
- request intake supports `referralSource` and `referralPartnerId`, but only authenticated patients can create requests
- `service_requests.patient_user_id` is still required, so partner-originated intake needs an explicit patient identity strategy
- admin ops read models already surface `referralSource`, but there is no partner actor, profile, or visibility boundary

So the next real roadmap move is not another architecture cleanup step.
It is making referral-led demand operationally real.

## Current Code Reality

### Existing strengths
- `@nurseconnect/domain-request` owns request creation invariants and lifecycle rules
- `@nurseconnect/domain-dispatch` owns assignment and reassignment policy
- `@nurseconnect/domain-admin-ops` already reads `referralSource` in queue projections
- `@nurseconnect/domain-identity` owns session-user bootstrap, `/api/me` shaping, and role-change policy
- `service_requests` already stores:
  - `requestType`
  - `scheduledFor`
  - `referralSource`
  - `referralPartnerId`
  - `careType`

### Existing gaps
- `packages/database/src/schema/users.ts` still defines `user_role` as only `admin`, `nurse`, and `patient`
- `apps/web/src/lib/canonical-routes.ts` has no partner route
- `packages/domain-identity/src/portal-access-policy.ts` still thinks in terms of `app` vs `admin`, not a partner portal
- `apps/web/src/app/api/requests/route.ts` hard-requires `patient` and always stamps `patientUserId = actor.id`
- there is no partner profile table or active/inactive state
- there is no package-owned rule for partner-owned request visibility
- there is no partner-facing projection over request and visit status

## Role Definition
For NurseConnect v1.0.0, a referral partner is:

> an authorized external demand-originating actor who can initiate care requests and monitor high-level outcomes, while NurseConnect retains operational control over triage, staffing, and fulfillment

That means the partner can:
- create referral-backed requests
- supply patient and care context
- view only their own referrals
- receive high-level status updates
- respond to follow-up information requests later if NurseConnect adds them

That does not mean the partner can:
- dispatch or choose nurses
- view internal assignment or audit history
- manage billing, payouts, or settlement state
- view all patient requests in the system
- act as a general admin

## Core Decisions

### 1. Referral Partner MVP is a launch-defining product slice, not another migration slice
The package migration through Step 8 is already sufficient.

The next value comes from making referral-led demand operational, not from extracting another preemptive seam with no product behind it.

### 2. Partner onboarding is admin-controlled in MVP
MVP should not include public partner self-signup.

The approved model is:
- an admin creates or identifies the user
- an admin changes their role to `referral_partner`
- an admin creates or activates the partner profile
- each partner profile maps to one operator user at launch

This keeps the first version operationally safe and avoids premature organization management.

### 3. The partner surface stays narrow
The MVP should include only:
- partner login and routing
- partner profile activation
- referral-backed request submission
- partner-scoped request list
- partner-scoped request detail with a limited status view

Do not add:
- organization hierarchies
- multiple partner users per organization
- partner-side billing
- partner SLA dashboards
- white-labeling

### 4. There is one shared request and dispatch system
Partner demand must not create a parallel queue or dispatch engine.

Partner-originated requests should still flow through:
- the same request creation path
- the same dispatch policies
- the same request lifecycle
- the same visit and notification read models

The only differences are:
- who is allowed to create the request
- how referral ownership is stamped
- what subset of request status is shown back to the partner

### 5. Partner visibility is limited and projected
Partners should not see raw internal ops truth by default.

For MVP, partner-facing status should be a constrained projection over the existing request lifecycle:
- `received`
  maps from `open`
- `scheduled`
  maps from `assigned`, `accepted`, and `enroute`
- `completed`
  maps from `completed`
- `could_not_fulfill`
  maps from `canceled` and `rejected`

This keeps the external surface simple without forcing a new internal lifecycle right now.

If a later triage slice introduces richer internal states, the partner projection can expand without breaking the underlying model.

### 6. Partner-authored intake must create a lightweight patient shell
Current request creation requires `patientUserId`.

That means Referral Partner MVP needs an explicit bridge for referred patients before `domain-patient` exists.

For MVP:
- a partner-submitted referral should create or reuse a lightweight patient-domain user record
- that record remains a `patient` user internally
- it is an ops-owned identity shell, not proof that the patient has a self-serve login journey

This is a pragmatic bridge, not the start of a `domain-patient` extraction.

The bridge exists because current request, visit, and notification projections already key off `patientUserId`.

### 7. This is the slice where `@nurseconnect/domain-referral` becomes real
Before this slice, `domain-referral` was future scaffolding.

After Step 8, the referral business rules are now specific enough to deserve their own package boundary.

`@nurseconnect/domain-referral` should own:
- referral partner profile state
- partner activation and deactivation policy
- partner request submission policy
- partner ownership checks for request visibility
- partner-facing request status projection
- partner request list/detail read models

It should not own:
- core request lifecycle
- dispatch allocation
- payment state
- patient profile domain behavior beyond the temporary intake bridge

### 8. `@nurseconnect/domain-identity` should expand role and routing, but not absorb referral policy
Identity should own:
- adding `referral_partner` to the role model
- canonical route support for `/partner`
- portal access and callback normalization for the new role
- `/api/me` projection updates for the new actor
- admin role-change policy updates so an admin can set the role safely

Identity should not own:
- partner profile data
- partner request ownership policy
- partner request list and detail rules

### 9. Admin and ops remain in control
Referral Partner MVP should strengthen the external demand surface without weakening NurseConnect control.

Admins and ops still own:
- activating partner accounts
- request review and operational handling
- dispatch and reassignment
- all internal queue and event visibility

The partner surface is an intake and tracking surface, not an operations console.

## Target Package Shape

```text
packages/
  domain-referral/
    src/
      errors.ts
      partner-profile.ts
      partner-request-intake.ts
      partner-request-projections.ts
      partner-status.ts
      index.ts
```

Related packages:
- `domain-identity`
  role model, routing, access policy
- `domain-request`
  request-core creation and lifecycle
- `domain-admin-ops`
  admin queue/detail visibility composed with partner context
- `domain-visit`
  existing visit/timeline reads that partner detail can build on where appropriate

## Package Responsibilities

### `domain-referral`
Should become the authoritative home for referral-specific business policy.

Initial responsibilities:
- validate that the acting user has an active partner profile
- stamp partner-owned request metadata safely
- enforce that partners can only see their own referrals
- translate internal request status into partner-visible status
- provide partner request list/detail read models

### `domain-identity`
Should expand only enough to support the new actor:
- add `referral_partner` to role types and DB enum
- support `/partner` as the canonical route
- allow auth and callback normalization to land partners there
- let admin role change flows set and preserve the new role

### `apps/web`
Should remain the composition layer:
- HTTP routes
- request parsing and response formatting
- page composition and form wiring
- auth/session adapters
- patient-shell creation orchestration until there is a real patient-domain extraction
- composition across `domain-referral`, `domain-request`, and `domain-admin-ops`

## Data Model Decisions

### User role
Extend the role enum from:
- `admin`
- `nurse`
- `patient`

to:
- `admin`
- `nurse`
- `patient`
- `referral_partner`

### New table: `referral_partners`
Minimal MVP fields:
- `id`
- `userId`
- `organizationName`
- `status`
  - `active`
  - `inactive`
- `createdAt`
- `updatedAt`

Rationale:
- `users` already owns the base identity fields
- `domain-identity` already owns base profile completion policy
- the partner table should hold partner-specific, not generic user, state

Do not duplicate base user fields like `name`, `phone`, and `city` unless implementation reality proves a real partner-only field is required.

### Service requests
Continue to reuse `service_requests`.

Keep using:
- `referralSource = "partner"`
- `referralPartnerId = users.id` for the authenticated referral partner user; `referral_partners.user_id` remains the bridge to the linked partner profile, not a separate foreign key target

Do not create a separate partner request table.

### Patient shell bridge
The implementation plan should define one explicit bridge for referred patients:
- create or find a lightweight patient user using the existing user aggregate
- pass that patient ID into the shared request creation seam

This bridge is acceptable for MVP because it preserves one request system and avoids premature `domain-patient` work.

## Product Surface

### Partner portal
Add a canonical `/partner` surface.

MVP screens:
- partner dashboard
  - summary of recent referrals
  - quick link to submit a new referral
- new referral form
- referral list
- referral detail

The partner portal should feel like a narrow operational inbox, not a full admin workspace.

### Admin surface
MVP admin changes should be minimal and explicit:
- admin can promote an existing user to `referral_partner`
- admin can create or activate the linked partner profile
- admin request views show when a request is partner-originated and which partner owns it

Do not build a broad partner-management console yet.

## Authorization Rules
- a `referral_partner` can access `/partner` and partner APIs
- a `referral_partner` cannot access patient-only request ownership flows
- patient users cannot access partner routes
- nurses cannot access partner routes
- admins retain access to admin surfaces only, not the partner portal by default
- partner request list/detail access must always be constrained by partner ownership

## MVP Success Criteria
This slice succeeds when all of the following are true:
- an admin can activate a referral partner account
- a referral partner can sign in and land on `/partner`
- a referral partner can submit a referral-backed request
- the request is created in the shared request system with correct referral ownership metadata
- the request still flows through the existing dispatch path
- the referral partner can see only their own requests
- the referral partner sees a limited status projection rather than raw internal ops data
- admin views clearly identify partner-originated requests

## Non-Goals
This spec does not include:
- public partner signup
- multi-user organizations
- partner-side dispatch or scheduling
- private-pay capture or settlement
- service-area controls
- full triage and exception handling
- reimbursement workflows
- a new patient-domain package

## Roadmap Consequence
After this spec, the roadmap should treat Referral Partner MVP as the next approved product slice for v1.0.0.

The follow-on implementation plan should define:
- the exact `domain-referral` scaffold
- role and routing expansion in `domain-identity`
- the patient-shell bridge for partner intake
- the partner list/detail projection shape
- the first executable task set in the Notion tracker
