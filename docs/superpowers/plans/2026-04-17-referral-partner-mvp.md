# Referral Partner MVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make referral-led demand operational by introducing the `referral_partner` actor, a narrow `/partner` portal, package-owned referral policy in `@nurseconnect/domain-referral`, and partner-scoped intake and visibility over the shared request and dispatch system.

**Architecture:** Treat this as the first launch-defining product slice after the migration, not as another preemptive extraction. `@nurseconnect/domain-referral` becomes the home for partner profile policy, partner request submission policy, ownership checks, and partner-facing request projections. `@nurseconnect/domain-identity` expands the role and routing model, `@nurseconnect/domain-request` remains the shared request core, and `apps/web` stays the adapter/orchestration layer that handles auth, HTTP, page composition, and the temporary patient-shell bridge required by the current `patientUserId` request model.

**Tech Stack:** pnpm workspaces, Turborepo, TypeScript, Next.js App Router, Drizzle/Postgres, Vitest, Playwright, `@nurseconnect/database`, `@nurseconnect/contracts`, `@nurseconnect/domain-identity`, `@nurseconnect/domain-request`, `@nurseconnect/domain-admin-ops`, `@nurseconnect/domain-visit`, and new `@nurseconnect/domain-referral`

---

## File Structure

### Database and shared-role foundation

- Create: `packages/database/src/schema/referral-partners.ts`
- Modify: `packages/database/src/schema/index.ts`
- Modify: `packages/database/src/schema/users.ts`
- Create: `packages/database/drizzle/0012_*.sql`
- Modify: `packages/database/drizzle/meta/_journal.json`
- Modify: generated snapshot files under `packages/database/drizzle/meta/*`
- Modify: `apps/web/src/types/role.ts`
- Modify: `apps/web/src/lib/canonical-routes.ts`
- Modify: `packages/domain-identity/src/admin-role-policy.ts`
- Modify: `packages/domain-identity/src/me-projection.ts`
- Modify: `packages/domain-identity/src/me-projection.test.ts`
- Modify: `packages/domain-identity/src/portal-access-policy.ts`
- Modify: `apps/web/src/server/auth/portal-access.ts`
- Modify: `apps/web/src/server/auth/require-role.ts`
- Modify: `apps/web/src/server/auth/require-role.db.test.ts`
- Modify: `apps/web/src/app/api/admin/users/[id]/role/route.ts`

### New `domain-referral` package

- Create: `packages/domain-referral/package.json`
- Create: `packages/domain-referral/tsconfig.json`
- Create: `packages/domain-referral/vitest.config.ts`
- Create: `packages/domain-referral/vitest.db.config.ts`
- Create: `packages/domain-referral/src/index.ts`
- Create: `packages/domain-referral/src/errors.ts`
- Create: `packages/domain-referral/src/partner-profile.ts`
- Create: `packages/domain-referral/src/partner-profile.test.ts`
- Create: `packages/domain-referral/src/partner-profile.db.test.ts`
- Create: `packages/domain-referral/src/partner-status.ts`
- Create: `packages/domain-referral/src/partner-status.test.ts`
- Create: `packages/domain-referral/src/partner-request-intake.ts`
- Create: `packages/domain-referral/src/partner-request-intake.test.ts`
- Create: `packages/domain-referral/src/partner-request-projections.ts`
- Create: `packages/domain-referral/src/partner-request-projections.db.test.ts`

### App-layer partner adapters and portal surfaces

- Create: `apps/web/src/app/(app)/partner/page.tsx`
- Create: `apps/web/src/app/(app)/partner/partner-client-page.tsx`
- Create: `apps/web/src/app/(app)/partner/requests/[id]/page.tsx`
- Create: `apps/web/src/app/api/partner/requests/route.ts`
- Create: `apps/web/src/app/api/partner/requests/[id]/route.ts`
- Create: `apps/web/src/components/partner/partner-dashboard-card.tsx`
- Create: `apps/web/src/components/partner/partner-request-form.tsx`
- Create: `apps/web/src/components/partner/partner-request-list.tsx`
- Create: `apps/web/src/components/partner/partner-request-detail.tsx`
- Create: `apps/web/src/server/partner/create-partner-patient-shell.ts`
- Create: `apps/web/src/server/partner/create-partner-patient-shell.db.test.ts`

### Request, admin, and regression adapters

- Modify: `apps/web/src/app/api/requests/route.ts`
- Modify: `apps/web/src/server/requests/allocate-request.ts`
- Modify: `packages/domain-admin-ops/src/active-request-queue.ts`
- Modify: `packages/domain-admin-ops/src/active-request-queue.db.test.ts`
- Modify: `packages/domain-admin-ops/src/ops-dashboard.ts`
- Modify: `packages/domain-admin-ops/src/ops-dashboard.test.ts`
- Create: `apps/web/tests/e2e-api/partner.api.e2e.ts`
- Modify: `apps/web/tests/e2e-api/admin-users.api.e2e.ts`
- Modify: `apps/web/tests/e2e-api/requests.api.e2e.ts`
- Modify: `pnpm-lock.yaml`

### Deliberate non-goals for this plan

- Do not introduce public partner self-signup
- Do not build multi-user partner organizations
- Do not create `@nurseconnect/domain-patient`
- Do not create a separate partner dispatch flow
- Do not redesign triage states or admin queue semantics in this slice
- Do not add partner billing, reimbursement, or settlement flows

## Execution Strategy

- Start from a fresh dedicated worktree off merged `main`.
- Land the role and DB foundation first so every later layer can depend on stable actor identity.
- Add the new `domain-referral` package before building portal screens; package policy should exist before app adapters.
- Keep request creation shared: partner intake should end by calling the existing create-and-assign seam with a stamped `patientUserId`, `referralSource = "partner"`, and correct `referralPartnerId`.
- Treat patient-shell creation as a temporary app-layer orchestration bridge and document it clearly in code comments and tests so it does not masquerade as a patient-domain design.
- Build partner-facing status as a projection over existing request lifecycle states instead of inventing new internal states here.
- Extend API and DB regression coverage before claiming the partner flow is ready.

## Chunk 1: Add Referral Partner Role, Routing, and Schema Foundation

### Task 1: Expand the role model and add the `referral_partners` table

**Files:**
- Create: `packages/database/src/schema/referral-partners.ts`
- Modify: `packages/database/src/schema/index.ts`
- Modify: `packages/database/src/schema/users.ts`
- Create: `packages/database/drizzle/0012_*.sql`
- Modify: `packages/database/drizzle/meta/_journal.json`
- Modify: generated snapshot files under `packages/database/drizzle/meta/*`
- Modify: `apps/web/src/types/role.ts`
- Modify: `apps/web/src/lib/canonical-routes.ts`

- [ ] **Step 1: Write the failing role and schema tests first**

Add and update tests so the red phase proves the new actor does not exist yet:
- extend `apps/web/src/server/auth/require-role.db.test.ts` with a case that a `referral_partner` user can be recognized after role expansion
- add a new DB assertion in the relevant schema test location or package-level DB smoke that a `referral_partners.user_id` row can be inserted only once per user
- extend any role utility tests around `apps/web/src/types/role.ts` and `apps/web/src/lib/canonical-routes.ts` to expect:
  - `referral_partner` is a valid role
  - canonical route is `/partner`
  - callback normalization preserves only partner-safe URLs

- [ ] **Step 2: Run the red phase**

Run:

```bash
pnpm type-check
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec vitest -c vitest.config.node.ts run src/server/auth/require-role.db.test.ts
```

Expected:
- type-check fails because `referral_partner` is not in the role unions and route maps
- DB tests fail because the new table and enum value do not exist yet

- [ ] **Step 3: Implement the minimal role and schema expansion**

Implement:
- extend `userRoleEnum` in `packages/database/src/schema/users.ts` to include `referral_partner`
- add `packages/database/src/schema/referral-partners.ts` with:
  - `id`
  - `userId`
  - `organizationName`
  - `status`
  - timestamps
- export the table from `packages/database/src/schema/index.ts`
- generate and commit the new migration under `packages/database/drizzle/0012_*.sql`
- extend:
  - `apps/web/src/types/role.ts`
  - `apps/web/src/lib/canonical-routes.ts`

Keep the partner route canonical mapping as:

```ts
const ROLE_TO_PATH: Record<Role, string> = {
  patient: "/dashboard",
  nurse: "/dashboard",
  admin: "/admin",
  referral_partner: "/partner",
};
```

- [ ] **Step 4: Verify the role and schema foundation**

Run:

```bash
pnpm type-check
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec vitest -c vitest.config.node.ts run src/server/auth/require-role.db.test.ts
pnpm --filter @nurseconnect/database exec drizzle-kit check
```

Expected:
- role types compile cleanly
- DB tests recognize the new role
- migration and schema remain consistent

- [ ] **Step 5: Commit**

```bash
git add packages/database apps/web/src/types/role.ts apps/web/src/lib/canonical-routes.ts
git commit -m "feat: add referral partner role foundation"
```

### Task 2: Expand identity routing and admin role change policy for partners

**Files:**
- Modify: `packages/domain-identity/src/admin-role-policy.ts`
- Modify: `packages/domain-identity/src/me-projection.ts`
- Modify: `packages/domain-identity/src/me-projection.test.ts`
- Modify: `packages/domain-identity/src/portal-access-policy.ts`
- Modify: `apps/web/src/server/auth/portal-access.ts`
- Modify: `apps/web/src/app/api/admin/users/[id]/role/route.ts`

- [ ] **Step 1: Add failing identity-policy tests**

Extend identity tests so they assert:
- `referral_partner` users resolve `/partner` as canonical route
- app-portal access redirects a partner away from `/dashboard`
- admin role changes can set `referral_partner`
- `/api/me` projection remains shape-compatible after the new role is added

- [ ] **Step 2: Run the red phase**

Run:

```bash
pnpm --filter @nurseconnect/domain-identity test
pnpm type-check
```

Expected:
- identity tests fail because the new role is not handled yet
- type-check fails where `Role` exhaustiveness still assumes three roles

- [ ] **Step 3: Implement the minimal identity expansion**

Update:
- `packages/domain-identity/src/admin-role-policy.ts`
  - permit `referral_partner` as a valid target role
- `packages/domain-identity/src/me-projection.ts`
  - preserve payload shape but allow the new role
- `packages/domain-identity/src/portal-access-policy.ts`
  - treat `/partner` as a first-class canonical route
- `apps/web/src/server/auth/portal-access.ts`
  - keep the adapter thin, only map the new route through the domain result
- `apps/web/src/app/api/admin/users/[id]/role/route.ts`
  - continue using typed policy mapping, not string-matching

- [ ] **Step 4: Verify the identity cutover**

Run:

```bash
pnpm --filter @nurseconnect/domain-identity test
pnpm type-check
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/admin-users.api.e2e.ts --project=api
```

Expected:
- identity package tests pass
- admin role-change flow still works
- partner canonical routing is ready for the portal layer

- [ ] **Step 5: Commit**

```bash
git add packages/domain-identity apps/web/src/server/auth apps/web/src/app/api/admin/users/[id]/role/route.ts
git commit -m "feat: expand identity routing for referral partners"
```

## Chunk 2: Create `@nurseconnect/domain-referral` and Partner Activation Policy

### Task 3: Scaffold `domain-referral` and own partner profile state

**Files:**
- Create: `packages/domain-referral/package.json`
- Create: `packages/domain-referral/tsconfig.json`
- Create: `packages/domain-referral/vitest.config.ts`
- Create: `packages/domain-referral/vitest.db.config.ts`
- Create: `packages/domain-referral/src/index.ts`
- Create: `packages/domain-referral/src/errors.ts`
- Create: `packages/domain-referral/src/partner-profile.ts`
- Create: `packages/domain-referral/src/partner-profile.test.ts`
- Create: `packages/domain-referral/src/partner-profile.db.test.ts`

- [ ] **Step 1: Write the failing package tests**

Create `packages/domain-referral/src/partner-profile.test.ts` with pure policy cases:
- active profile is required for partner operations
- inactive profile blocks partner request submission
- blank organization name is rejected

Create `packages/domain-referral/src/partner-profile.db.test.ts` with DB-backed cases:
- create partner profile for a `referral_partner` user
- reject duplicate profile creation for the same `userId`
- allow activation and deactivation updates

- [ ] **Step 2: Run the red phase**

Run:

```bash
pnpm --filter @nurseconnect/domain-referral test
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter @nurseconnect/domain-referral run test:db
```

Expected:
- package scripts fail because the package does not exist yet
- unit and DB tests fail because profile policy is missing

- [ ] **Step 3: Implement the minimal partner-profile module**

Create the package scaffold to match existing domain packages and implement:

```ts
export class ReferralPartnerValidationError extends Error {}
export class ReferralPartnerNotFoundError extends Error {}
export class ReferralPartnerInactiveError extends Error {}
```

In `partner-profile.ts`, export:
- `createReferralPartnerProfile(...)`
- `getReferralPartnerProfileByUserId(...)`
- `assertReferralPartnerActive(...)`
- `setReferralPartnerStatus(...)`

The package should validate:
- the linked user exists
- the linked user role is `referral_partner`
- there is only one partner profile per user

- [ ] **Step 4: Verify the package baseline**

Run:

```bash
pnpm --filter @nurseconnect/domain-referral test
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter @nurseconnect/domain-referral run test:db
pnpm type-check
```

Expected:
- new package tests pass
- package exports are stable
- workspace type-check stays green

- [ ] **Step 5: Commit**

```bash
git add packages/domain-referral pnpm-lock.yaml
git commit -m "feat: add referral partner profile domain"
```

### Task 4: Add minimal admin enablement for partner profiles

**Files:**
- Modify: `apps/web/src/app/admin/users/page.tsx`
- Modify: `apps/web/src/app/admin/users/user-table.tsx`
- Create: `apps/web/src/app/api/admin/referral-partners/route.ts`
- Create: `apps/web/src/app/api/admin/referral-partners/[userId]/route.ts`

- [ ] **Step 1: Write the failing admin API tests**

Add API coverage that proves:
- an admin can create a partner profile for a `referral_partner` user
- non-admin actors are rejected
- an inactive profile cannot be used later by partner intake

- [ ] **Step 2: Run the red phase**

Run:

```bash
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/admin-users.api.e2e.ts --project=api
```

Expected: FAIL because the partner profile admin APIs and minimal UI affordance do not exist yet.

- [ ] **Step 3: Implement the thinnest admin enablement**

Add:
- `POST /api/admin/referral-partners`
  - create a partner profile for an existing `referral_partner` user
- `PATCH /api/admin/referral-partners/[userId]`
  - activate or deactivate the profile

Keep the UI thin:
- one explicit create/activate affordance in admin users
- do not build a full partner-management console

- [ ] **Step 4: Verify admin partner enablement**

Run:

```bash
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/admin-users.api.e2e.ts --project=api
pnpm type-check
```

Expected:
- admin can prepare a partner account end to end
- non-admins remain blocked

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/admin/users apps/web/src/app/api/admin/referral-partners
git commit -m "feat: add admin referral partner enablement"
```

## Chunk 3: Build Partner Intake on the Shared Request System

### Task 5: Add the patient-shell bridge and partner request submission policy

**Files:**
- Create: `apps/web/src/server/partner/create-partner-patient-shell.ts`
- Create: `apps/web/src/server/partner/create-partner-patient-shell.db.test.ts`
- Create: `packages/domain-referral/src/partner-request-intake.ts`
- Create: `packages/domain-referral/src/partner-request-intake.test.ts`
- Modify: `packages/domain-referral/src/index.ts`
- Modify: `apps/web/src/server/requests/allocate-request.ts`
- Create: `apps/web/src/app/api/partner/requests/route.ts`

- [ ] **Step 1: Write the failing tests first**

Add package tests for `partner-request-intake.ts` that assert:
- only an active partner profile can submit a partner request
- partner intake always stamps `referralSource = "partner"`
- a partner cannot spoof another partner’s `referralPartnerId`

Add DB tests for `create-partner-patient-shell.ts` that assert:
- a lightweight patient user can be created from referral contact data
- the helper can reuse an existing patient shell when the identity match strategy says it is safe
- the helper does not assign `referral_partner` or `nurse` roles accidentally

Add API tests for `POST /api/partner/requests` that prove:
- a partner can create a request
- the created request stores the partner metadata correctly
- the underlying request still goes through the shared allocation path

- [ ] **Step 2: Run the red phase**

Run:

```bash
pnpm --filter @nurseconnect/domain-referral test
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec vitest -c vitest.config.node.ts run src/server/partner/create-partner-patient-shell.db.test.ts
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/partner.api.e2e.ts --project=api
```

Expected:
- package tests fail because partner intake helpers are missing
- DB bridge tests fail because the patient-shell helper does not exist
- partner API tests fail because `/api/partner/requests` does not exist

- [ ] **Step 3: Implement the minimal partner intake seam**

In `packages/domain-referral/src/partner-request-intake.ts`, export something like:

```ts
export function buildPartnerRequestInput(input: {
  actorUserId: string;
  partnerStatus: "active" | "inactive";
  request: CreateRequestInput;
}) {
  assertReferralPartnerActive(input.partnerStatus);

  return {
    ...input.request,
    referralSource: "partner" as const,
    referralPartnerId: input.actorUserId,
  };
}
```

In `apps/web/src/server/partner/create-partner-patient-shell.ts`, create a narrow helper that:
- inserts or reuses a `patient` user identity shell
- sets only the minimum fields needed for request ownership and later ops follow-up
- does not try to become a generic patient profile domain

In `apps/web/src/app/api/partner/requests/route.ts`:
- require `referral_partner`
- resolve the active partner profile
- create or reuse the patient shell
- call `createAndAssignRequest(...)` with stamped partner metadata

- [ ] **Step 4: Verify the partner intake flow**

Run:

```bash
pnpm --filter @nurseconnect/domain-referral test
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec vitest -c vitest.config.node.ts run src/server/partner/create-partner-patient-shell.db.test.ts
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/partner.api.e2e.ts tests/e2e-api/requests.api.e2e.ts --project=api
```

Expected:
- partner intake is green
- request creation still uses the shared allocation seam
- patient request APIs remain unchanged for patient actors

- [ ] **Step 5: Commit**

```bash
git add packages/domain-referral/src/partner-request-intake.ts apps/web/src/server/partner apps/web/src/app/api/partner/requests/route.ts apps/web/tests/e2e-api/partner.api.e2e.ts
git commit -m "feat: add partner request intake"
```

## Chunk 4: Add Partner Visibility, Portal UI, and Admin Read Context

### Task 6: Add partner-owned request projections and limited status mapping

**Files:**
- Create: `packages/domain-referral/src/partner-status.ts`
- Create: `packages/domain-referral/src/partner-status.test.ts`
- Create: `packages/domain-referral/src/partner-request-projections.ts`
- Create: `packages/domain-referral/src/partner-request-projections.db.test.ts`
- Create: `apps/web/src/app/api/partner/requests/[id]/route.ts`
- Create: `apps/web/src/app/(app)/partner/page.tsx`
- Create: `apps/web/src/app/(app)/partner/partner-client-page.tsx`
- Create: `apps/web/src/app/(app)/partner/requests/[id]/page.tsx`
- Create: `apps/web/src/components/partner/partner-dashboard-card.tsx`
- Create: `apps/web/src/components/partner/partner-request-form.tsx`
- Create: `apps/web/src/components/partner/partner-request-list.tsx`
- Create: `apps/web/src/components/partner/partner-request-detail.tsx`

- [ ] **Step 1: Write the failing tests first**

Add unit tests for the status mapper:
- `open -> received`
- `assigned | accepted | enroute -> scheduled`
- `completed -> completed`
- `canceled | rejected -> could_not_fulfill`

Add DB tests for partner projections:
- list query returns only the actor’s own referrals
- detail query blocks cross-partner access
- detail query exposes limited projection fields only

Add API tests for:
- `GET /api/partner/requests`
- `GET /api/partner/requests/[id]`

- [ ] **Step 2: Run the red phase**

Run:

```bash
pnpm --filter @nurseconnect/domain-referral test
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter @nurseconnect/domain-referral run test:db
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/partner.api.e2e.ts --project=api
```

Expected:
- projection tests fail because the status mapper and request queries are missing
- API tests fail because list/detail routes do not exist

- [ ] **Step 3: Implement the partner projection surface**

In `partner-status.ts`, export the external projection mapper.

In `partner-request-projections.ts`, expose read models such as:
- `listPartnerRequests(db, { actorUserId })`
- `getPartnerRequestDetail(db, { actorUserId, requestId })`

These functions should:
- require an active partner profile
- filter by `referralPartnerId = actorUserId`
- project only safe fields
- never expose full internal audit or admin-only data

Wire those into:
- `GET /api/partner/requests`
- `GET /api/partner/requests/[id]`
- `/partner` dashboard and request detail pages

- [ ] **Step 4: Verify the partner portal**

Run:

```bash
pnpm --filter @nurseconnect/domain-referral test
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter @nurseconnect/domain-referral run test:db
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/partner.api.e2e.ts --project=api
pnpm type-check
```

Expected:
- partners can see only their own referrals
- status projection is stable and limited
- portal routes compile and render cleanly

- [ ] **Step 5: Commit**

```bash
git add packages/domain-referral apps/web/src/app/(app)/partner apps/web/src/app/api/partner apps/web/src/components/partner
git commit -m "feat: add partner request visibility"
```

### Task 7: Add partner context to admin read surfaces and run full regression

**Files:**
- Modify: `packages/domain-admin-ops/src/active-request-queue.ts`
- Modify: `packages/domain-admin-ops/src/active-request-queue.db.test.ts`
- Modify: `packages/domain-admin-ops/src/ops-dashboard.ts`
- Modify: `packages/domain-admin-ops/src/ops-dashboard.test.ts`
- Modify: `apps/web/tests/e2e-api/admin-users.api.e2e.ts`
- Modify: `apps/web/tests/e2e-api/partner.api.e2e.ts`
- Modify: `apps/web/tests/e2e-api/requests.api.e2e.ts`

- [ ] **Step 1: Write the failing admin read-model tests**

Extend admin ops coverage so it proves:
- active queue identifies partner-originated requests clearly
- dashboard read models can show partner context without changing core queue semantics
- patient and partner request flows still coexist cleanly

- [ ] **Step 2: Run the red phase**

Run:

```bash
pnpm --filter @nurseconnect/domain-admin-ops test
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/admin-users.api.e2e.ts tests/e2e-api/partner.api.e2e.ts tests/e2e-api/requests.api.e2e.ts --project=api
```

Expected: FAIL because admin read models do not yet include explicit partner context and the new end-to-end flow is incomplete.

- [ ] **Step 3: Implement the minimal admin visibility updates**

Update admin read models to include:
- whether `referralSource === "partner"`
- partner identity label where the queue/detail already has room for it

Keep this deliberately small:
- no new admin workflow state
- no triage redesign
- no partner-management dashboard

- [ ] **Step 4: Run full regression and live validation**

Run:

```bash
pnpm --filter @nurseconnect/domain-referral test
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter @nurseconnect/domain-referral run test:db
pnpm --filter @nurseconnect/domain-identity test
pnpm --filter @nurseconnect/domain-admin-ops test
pnpm type-check
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/admin-users.api.e2e.ts tests/e2e-api/partner.api.e2e.ts tests/e2e-api/requests.api.e2e.ts --project=api
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web build
```

Then run a live headed Playwright scenario the user can watch covering:
- admin promotes and activates a partner account
- partner signs in and lands on `/partner`
- partner submits a referral-backed request
- partner sees the request in their own list/detail only
- admin sees the same request as partner-originated in ops surfaces

- [ ] **Step 5: Commit**

```bash
git add packages/domain-admin-ops apps/web/tests/e2e-api
git commit -m "feat: finish referral partner mvp"
```

## Ready State

This plan is complete when:
- the repo has an approved `domain-referral` boundary
- partner activation is admin-controlled
- partner intake uses the shared request system
- the patient-shell bridge is explicit and tested
- partners can see only their own referrals through limited status projection
- admin views clearly identify partner-originated demand
- the full flow passes API regression, type-check, build, and live browser validation
