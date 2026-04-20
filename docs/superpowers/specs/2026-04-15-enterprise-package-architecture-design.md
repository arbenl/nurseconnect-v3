# NurseConnect Enterprise Package Architecture

Date: 2026-04-15
Status: Living roadmap, updated through merged Step 7 (`@nurseconnect/domain-visit`)
Updated: 2026-04-17
Scope: Monorepo package architecture before `Referral Partner MVP`

## Purpose

Define the target enterprise package architecture for NurseConnect so the repo can evolve from an `apps/web`-centric implementation into domain-centered modules without a stop-the-world rewrite.

This spec is intentionally about package boundaries, dependency rules, and migration order. It is not a feature spec for a single workflow.

## Executive Summary

NurseConnect should adopt a **domain-first package architecture** with **one web app now**, **mobile-ready shared layers**, and **gradual extraction from `apps/web`**.

The architecture must support the actual business model:

- verified nurse supply
- referral-led demand
- scheduled-first care with a same-day fast lane only when density allows
- strong admin and operations control
- private-pay charging and payout traceability
- city-by-city service-area discipline

The repo should not be reorganized around user portals first. Patient, nurse, admin, and referral-partner surfaces are delivery views over shared business rules. The durable center is the domain model.

## Current Roadmap Status

Completed on `main`:

- `platform-telemetry` shared foundation
- `domain-request` core extraction
- `domain-identity` foundation and later `User` aggregate expansion
- `domain-nurse`
- `domain-dispatch`
- `domain-admin-ops`
- `domain-visit`

Still intentionally future:

- `domain-patient`
- `domain-referral`
- `domain-payments`

So this document is no longer a speculative sequence. It is a living roadmap that must match the executed slices already merged into `main`.

## Decisions

### 1. Single App Now, Multi-App Later

The current target is:

- `apps/web` as the single delivery app
- shared domain packages underneath it
- explicit room for a future `apps/mobile` only if product needs justify it later

We are not splitting into patient, nurse, admin, or partner apps now.

### 2. Domain-First Package Boundaries

Primary package boundaries should follow business domains, not portals.

Do not make these the main architecture:

- `packages/patient-portal`
- `packages/nurse-portal`
- `packages/admin-portal`

That shape duplicates rules and pushes the real business logic back into UI-centric code.

### 3. Gradual Extraction, Not Rewrite

The migration strategy is incremental:

- keep `apps/web` running
- extract one domain at a time
- move business rules first
- leave page composition, transport, and route wiring in place until seams are proven

### 4. Mobile-Ready, Not Mobile-Split

The architecture must remain mobile-ready:

- domain packages stay UI-agnostic
- shared UI primitives must support responsive and touch-friendly behavior
- shared contracts must be reusable by a future mobile client

But there is no separate mobile app boundary yet.

## Commercial Invariants

The architecture is not only a technical cleanup. It must preserve the profitable operating model.

The key commercial invariants are:

- only verified, in-date, eligible nurses enter dispatchable supply
- referral-led intake remains a first-class path, not an afterthought
- scheduled-first demand is the default
- same-day dispatch is constrained by capacity and coverage, not wishful availability
- service areas and density rules protect market economics
- admin and ops can intervene safely in queue, supply, and exception flows
- payment authorization, charging, payout owed, and settlement state are auditable

These invariants should be expressed through the domain packages below, not through a vague catch-all commercial module.

## Target Monorepo Shape

```text
apps/
  web/

packages/
  domain-identity/         # implemented
  domain-nurse/            # implemented
  domain-request/          # implemented
  domain-dispatch/         # implemented
  domain-admin-ops/        # implemented
  domain-visit/            # implemented
  domain-patient/          # later, when patient profile/household logic is real
  domain-referral/         # later
  domain-payments/         # later

  platform-db/
  platform-contracts/
  platform-ui/
  platform-telemetry/
```

## Package Responsibilities

### `apps/web`

Owns:

- Next.js App Router routes, layouts, and API route handlers
- page composition
- client-side form state and interactions
- portal-specific view models
- request/response transport wiring
- HTTP response formatting and transport-specific error adapters
- auth/session cookie integration
- Better-Auth and `next/headers` session provider integration
- canonical route mapping and route normalization
- dependency composition

Does not own:

- core business policies
- durable state machines
- allocation rules
- credential eligibility rules
- audit and telemetry primitives

### `packages/domain-identity`

Owns:

- session user resolution rules
- portal access rules
- role and authorization policies
- user projection rules from auth session into domain user model
- domain user bootstrap/upsert
- profile update policy for the base `users` aggregate
- `/api/me` projection shaping
- admin role-change policy
- first-admin bootstrap policy

Current likely sources:

- identity policy modules currently under `apps/web/src/server/auth/*`
- `apps/web/src/lib/user-service.ts` identity and user projection responsibilities
- `packages/contracts/src/user.ts`

Important notes:

- `apps/web/src/server/auth/http.ts` is a transport adapter and should stay in `apps/web`. Domain identity should expose typed errors and policies, not `NextResponse` formatting.
- session provider integration such as Better-Auth and `next/headers` stays in `apps/web` as an adapter. `domain-identity` receives resolved session data through a defined boundary, not by importing framework libraries.
- `apps/web/src/server/auth/get-session.ts` should remain an app adapter around Better-Auth and `next/headers`, even if the downstream identity resolution logic moves into a domain package.
- canonical route mapping such as `apps/web/src/lib/canonical-routes.ts` stays in `apps/web`. Portal access policy can consume route resolution through injected config or resolved inputs, but it should not own URL mapping.

### `packages/domain-nurse`

Owns:

- nurse credential lifecycle
- nurse eligibility policy
- nurse operating state
- nurse availability rules
- nurse location update policy
- nurse profile creation/read rules

Current likely sources:

- `apps/web/src/server/admin/nurse-credentials.ts`
- `apps/web/src/server/nurse-location/*`
- nurse-related logic currently inside `apps/web/src/lib/user-service.ts`
- `packages/contracts/src/nurse-credential.ts`

Important note:

Nurse credential logic currently sits under an admin folder, but it is nurse-domain logic. Admin uses it; it does not define the domain boundary.

### `packages/domain-request`

Owns:

- request creation rules
- request lifecycle and transition policy
- request action rules
- request write-side event emission
- request-level validation shared across intake and downstream execution

Current likely sources:

- `apps/web/src/server/requests/request-lifecycle.ts`
- `apps/web/src/server/requests/request-actions.ts`
- request-creation responsibilities currently embedded in `allocate-request.ts`
- write-side pieces of `request-events.ts`

Important note:

The request lifecycle is business policy, not merely a contract. It should not live in `platform-contracts`.

### `packages/domain-dispatch`

Owns:

- nearest-match selection policy
- candidate ranking
- reassignment policy
- supply consumption and release rules
- later: service-area eligibility, same-day fast-lane rules, and density-aware constraints

Current likely sources:

- `apps/web/src/server/requests/allocate-request.ts`
- `apps/web/src/server/requests/admin-reassign.ts`

Important note:

Dispatch depends on nurse operating state and request core, but it should not own those domains.

### `packages/domain-admin-ops`

Owns:

- admin queue/read-model use cases
- ops dashboard composition use cases
- activity feed/read-side use cases
- triage-oriented admin views and exception workflows

Current likely sources:

- `apps/web/src/server/admin/*`
- `apps/web/src/server/requests/admin-active-queue.ts`
- `apps/web/src/server/requests/triage-severity.ts`

### `packages/domain-patient`

Future domain.

This should not be treated as a major extraction step yet because the repo still has limited patient-specific business logic beyond generic user profile, request ownership, and visit consumption. Base profile rules already moved into `domain-identity`, and live patient visit reads now live in `domain-visit`.

When `domain-patient` becomes real, it should own:

- patient-specific profile rules that go beyond the shared `users` aggregate
- household context
- family and caregiver context if introduced
- saved addresses, patient preferences, consent, or similar patient-owned state if those become real product concepts

### `packages/domain-visit`

Implemented as a read-model package in Step 7.

It currently owns:

- patient and nurse live visit projections
- actor-scoped visit timeline reads
- actor-scoped visit notification reads
- shared visit-state helpers

Future expansion may add broader visit progression or completion semantics only if those become a real domain separate from request lifecycle and dispatch policy.

### `packages/domain-referral`

Future domain.

This should own:

- referral partner actor model
- partner intake and scoped visibility rules
- referral-originated request behavior

### `packages/domain-payments`

Future domain.

This should own:

- pricing rules
- charge eligibility
- authorization/capture state
- payout owed
- settlement state
- refund and exception paths

### `packages/platform-db`

Owns:

- Drizzle schema
- migrations
- repository and transaction adapters
- DB-specific query implementations
- unit-of-work support where needed

This package is a persistence adapter layer, not a domain layer.

In code, this refers to the existing `@nurseconnect/database` package in `packages/database`, evolved to include repository adapters and transaction helpers. No package rename is required.

### `packages/platform-contracts`

Owns:

- shared DTOs
- validation schemas for external and cross-package boundaries
- wire-safe request and response shapes

It does not own business policy or state machines.

In code, this refers to the existing `@nurseconnect/contracts` package in `packages/contracts`.

### `packages/platform-ui`

Owns:

- shared UI primitives
- design tokens
- responsive and mobile-safe spacing primitives
- accessible interaction patterns

In code, this refers to the existing `@nurseconnect/ui` package in `packages/ui`.

### `packages/platform-telemetry`

Owns:

- structured audit writing
- request logging helpers
- shared telemetry helpers

Current likely sources:

- `apps/web/src/server/admin/audit.ts`
- `apps/web/src/server/telemetry/ops-logger.ts`

## Dependency Rules

The default dependency flow should look like this:

```text
apps/web
  -> domain-*
  -> platform-ui
  -> platform-contracts
  -> platform-telemetry
  -> platform-db

domain-*
  -> platform-db
  -> platform-contracts
  -> platform-telemetry when shared audit/logging is needed
  -> other domain packages only when explicitly allowed
  -> never Next.js, React, or route code

platform-db
  -> Drizzle/Postgres/sql implementations

platform-ui
  -> React/UI-only concerns

platform-contracts
  -> schema and boundary concerns only

platform-telemetry
  -> shared audit/logging concerns only
```

Practical rule:

- if code decides what is allowed, it belongs in a domain package
- if code decides how something is rendered, routed, or persisted, it belongs in `apps/web` or a platform package

Important migration note:

- port-based DB access is a target pattern, not a day-one precondition for extraction
- during initial extraction, domain packages may import `@nurseconnect/database` directly
- the hard ban is on framework and route coupling, not on all persistence coupling from the first move

## Database Access Pattern

Current reality:

- app-local server modules import `db`, `schema`, `sql`, and Drizzle helpers directly from `@nurseconnect/database`
- some flows rely on explicit transaction behavior and `FOR UPDATE SKIP LOCKED`

Target rule:

- extracted domain packages should trend toward repository or transaction boundaries instead of route-local DB usage
- `platform-db` should absorb repository helpers and unit-of-work support over time
- complex lock-heavy SQL should be hidden behind repository methods or transaction-scoped helpers once the relevant domain seam is stable

This matters most for dispatch because allocation and reassignment rely on explicit locking behavior.

During migration:

- domain packages may accept a `db` or `tx` handle as an injected dependency
- domain packages may import `@nurseconnect/database` directly while seams are still being extracted
- repository ports should support raw SQL execution for queries that require explicit locking such as `FOR UPDATE SKIP LOCKED` or cross-table joins that are awkward to express through Drizzle's query builder

## Request Core vs Dispatch Seam

This is the most sensitive boundary in the repo.

Current reality:

- `createAndAssignRequest()` creates the service request
- finds candidates
- uses `FOR UPDATE SKIP LOCKED`
- assigns the nearest nurse
- emits request events
- all inside one Postgres transaction

We must not split this into naive two-step application logic too early.

Rule:

- request creation and dispatch may stay a **composed transaction** during migration
- `domain-request` owns request creation rules and lifecycle policy
- `domain-dispatch` owns candidate selection and assignment policy
- the seam is explicit, but the transaction can remain intact until a deliberate redesign is justified

If this seam is redesigned later, it must be done consciously, with a plan for:

- race safety
- assignment idempotency
- unassigned request behavior
- event emission order

## Request Events

Current reality:

- request event append is used by creation, dispatch, reassignment, and request actions
- read-side query functions support timelines and notifications for multiple actor types

Rule:

- the write-side primitive belongs with request core
- consumer-specific read models can live in the relevant consuming domain or app adapter layer

Do not force request events into a generic event-log package unless the system later adopts a broader event architecture that genuinely justifies it.

## Migration Sequence

The roadmap below reflects the sequence actually executed through Step 7.

### Step 0: Shared Foundations

Extract shared cross-cutting and request-core foundations first.

Create:

- `packages/platform-telemetry`
  - `recordAdminAction`
  - `ops-logger`
- `packages/domain-request` foundation
  - request lifecycle rules
  - request event write primitive

Why first:

- these concerns are used by multiple domains
- leaving them in `apps/web` would create backward dependencies during extraction

### Step 1: `domain-identity` foundations

Extract:

- identity policy logic currently under `apps/web/src/server/auth/*`, excluding transport adapters
- identity and projection responsibilities from `apps/web/src/lib/user-service.ts`
- user-related boundary contracts

Why first:

- all portals depend on session user, access, and role resolution

### Step 2: `domain-nurse`

Extract:

- nurse credential lifecycle
- nurse eligibility rules
- nurse location operating state
- nurse profile creation/read logic currently mixed into `user-service.ts`

Why next:

- trusted supply is a core business invariant
- dispatch and admin both depend on nurse truth

### Step 3: `domain-request`

Extract:

- request creation rules
- request action rules
- request state transitions
- shared request write-side event logic

Why next:

- request behavior is the common seam for patient and future referral demand
- request core should be stabilized before deeper dispatch extraction

### Step 4: `domain-dispatch`

Extract:

- allocation policy
- nearest-match ranking
- reassignment
- supply consumption/release logic

Why next:

- dispatch is commercially critical
- but it must sit on top of stable nurse truth and request core

Important guardrail:

- preserve the current atomic transaction boundary until a replacement design is ready

### Step 5: `domain-admin-ops`

Extract:

- ops dashboards
- active request queue/read model
- activity feed/read model
- triage-oriented ops use cases

Why now:

- by this point, admin read models can compose stabilized domain capabilities instead of owning hidden business logic

### Step 6: `domain-identity` user expansion

Extract:

- domain user bootstrap/upsert
- profile update policy for the base `users` aggregate
- `/api/me` projection shaping
- admin role-change policy

Why next:

- after request, dispatch, and admin ops were stabilized, the remaining `User` aggregate logic was still split between route handlers and app-local service helpers
- this closes the identity/user seam without inventing a premature `domain-patient` package

### Step 7: `domain-visit`

Extract:

- patient live visit projections
- nurse live visit projections
- actor-scoped timeline reads
- actor-scoped notification reads
- shared visit-state helpers

Why next:

- after request write policy and dispatch write policy were stable, the remaining live care experience read side was ready to move into its own package
- this gave patient and nurse portal reads a dedicated home without reopening request or dispatch mutation seams

## Future Domain Scaffolding

These are real future domains, but not the next migration steps:

- `domain-patient`
- `domain-referral`
- `domain-payments`

They should be presented as future scaffolding, not as if there is already mature logic waiting to be extracted.

## What Must Stay in `apps/web` During Migration

Keep these in `apps/web` while domains are extracted:

- routes and layouts
- API route handlers
- page composition and view models
- client interaction and form wiring
- temporary facades and dependency composition

Package extraction without real behavioral ownership is fake progress.

## Non-Goals

This spec does not:

- split the product into multiple apps now
- define a native mobile app
- redesign the dispatch transaction model immediately
- force every piece of code into a package before the seam is stable
- create a generic `domain-kernel` dumping ground

## Success Criteria

This architecture is succeeding when:

- `apps/web` gets thinner over time
- business rules stop accumulating in app-local server modules
- extracted domains own real policies and tests
- cross-cutting concerns stop hiding under portal-specific folders
- dispatch safety is preserved during extraction
- the repo becomes ready for `Referral Partner MVP` without adding another app or duplicating domain logic

## Open Implementation Implications

The implementation plan that follows this spec should explicitly define:

- package naming and workspace registration changes
- initial package scaffolds and dependency constraints
- repository and transaction port design for extracted domains
- the first incremental move for Step 0 and Step 1
- how to test each extracted domain without regressing current behavior
