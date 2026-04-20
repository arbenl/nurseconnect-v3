# Brownfield Corrections Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the current V3 codebase into alignment with the approved NurseConnect blueprint by removing self-activation, enforcing verified credential gating, adding admin credential review, and extending request intake fields without rewriting the request lifecycle.

**Architecture:** Keep credential truth on the existing `nurses` table for Phase 1. Promote `nurses.status` from free text to a proper enum aligned to the approved credential lifecycle, expose nurse application state through `/api/me` even before role promotion, and gate dispatch on verified non-expired credentials. Do not change the request lifecycle state machine in this slice; add only the new intake fields needed for referral-led and scheduled demand.

**Tech Stack:** Next.js App Router, Better Auth, Drizzle ORM, PostgreSQL, Zod, Vitest, Playwright

---

## Assumptions

- Map existing `nurses.status = 'pending'` rows to `submitted` during migration.
- Keep the patient-facing card, but repurpose it into an application flow. Users may apply; only admins may activate supply by promoting a verified applicant into the nurse role.
- Keep request status semantics unchanged in this slice. `submitted`, `triaged`, `declined`, and `unfulfilled` remain blueprint targets for a later plan.
- Execute this plan in a dedicated worktree before touching production code.

## File Map

**Create**
- `packages/contracts/src/nurse-credential.ts`
- `packages/contracts/src/nurse-credential.test.ts`
- `apps/web/src/server/admin/nurse-credentials.ts`
- `apps/web/src/app/api/admin/nurses/route.ts`
- `apps/web/src/app/api/admin/nurses/[id]/verify/route.ts`
- `apps/web/src/app/api/admin/nurses/[id]/reject/route.ts`
- `apps/web/src/app/api/admin/nurses/[id]/suspend/route.ts`
- `apps/web/src/app/admin/nurses/page.tsx`
- `apps/web/src/app/admin/nurses/[id]/page.tsx`
- `apps/web/src/app/admin/nurses/[id]/nurse-actions.tsx`
- `apps/web/tests/e2e-api/admin-nurse-credentials.api.e2e.ts`
- `apps/web/src/components/dashboard/nurse-application-status-card.tsx`

**Modify**
- `packages/contracts/src/index.ts`
- `packages/contracts/src/requests.ts`
- `packages/database/src/schema/nurses.ts`
- `packages/database/src/schema/service-requests.ts`
- `packages/database/drizzle/*` and `packages/database/drizzle/meta/*`
- `apps/web/src/server/admin/audit.ts`
- `apps/web/src/app/api/me/become-nurse/route.ts`
- `apps/web/src/app/api/me/route.ts`
- `apps/web/src/types/me.ts`
- `apps/web/src/hooks/use-user-profile.ts`
- `apps/web/src/components/dashboard/become-nurse-card.tsx`
- `apps/web/src/app/(app)/dashboard/dashboard-client-page.tsx`
- `apps/web/src/app/(auth)/onboarding/page.tsx`
- `apps/web/src/app/profile/page.tsx`
- `apps/web/src/server/requests/allocate-request.ts`
- `apps/web/src/server/requests/admin-reassign.ts`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/admin/requests/[id]/page.tsx`
- `apps/web/tests/e2e-api/nurse.api.e2e.ts`
- `apps/web/tests/e2e-api/requests.api.e2e.ts`
- `apps/web/tests/e2e-api/admin-request-reassign.api.e2e.ts`
- `apps/web/tests/e2e-ui/nurse.spec.ts`
- `apps/web/tests/e2e-utils/db.ts`
- `apps/web/src/server/requests/allocate-request.db.test.ts`

## Chunk 1: Trust Data Model

### Task 1: Add credential contracts

**Files:**
- Create: `packages/contracts/src/nurse-credential.ts`
- Create: `packages/contracts/src/nurse-credential.test.ts`
- Modify: `packages/contracts/src/index.ts`

- [ ] **Step 1: Write the failing contract test**

Add a test that asserts:
- `NurseStatusEnum` accepts `draft`, `submitted`, `under_review`, `verified`, `rejected`, `suspended`, `expired`, `renewal_pending`
- `AdminVerifyNurseSchema` requires `licenseValidUntil`
- `AdminRejectNurseSchema` accepts an optional reason
- `AdminSuspendNurseSchema` requires a reason

- [ ] **Step 2: Run the contracts test to verify it fails**

Run: `pnpm --filter contracts test src/nurse-credential.test.ts`
Expected: FAIL because the file and exports do not exist yet.

- [ ] **Step 3: Add the contract module**

Implement `packages/contracts/src/nurse-credential.ts` with:
- `NurseStatusEnum`
- `NurseCredentialSchema`
- `AdminVerifyNurseSchema`
- `AdminRejectNurseSchema`
- `AdminSuspendNurseSchema`

Export the module from `packages/contracts/src/index.ts`.

- [ ] **Step 4: Run the contracts test to verify it passes**

Run: `pnpm --filter contracts test src/nurse-credential.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/nurse-credential.ts packages/contracts/src/nurse-credential.test.ts packages/contracts/src/index.ts
git commit -m "feat(contracts): add nurse credential schemas"
```

### Task 2: Convert `nurses.status` into a real credential-state enum

**Files:**
- Modify: `packages/database/src/schema/nurses.ts`
- Modify: `packages/database/drizzle/*`
- Modify: `packages/database/drizzle/meta/*`
- Modify: `apps/web/tests/e2e-utils/db.ts`

- [ ] **Step 1: Update the schema**

Change `nurses.status` from `text("status")` to a `pgEnum` that matches the approved lifecycle:
- `draft`
- `submitted`
- `under_review`
- `verified`
- `rejected`
- `suspended`
- `expired`
- `renewal_pending`

Add nullable Phase 1 credential metadata fields:
- `licenseJurisdiction`
- `licenseValidUntil`
- `verifiedBy`
- `verifiedAt`
- `suspendedAt`
- `suspensionReason`

- [ ] **Step 2: Generate and inspect the migration**

Run: `pnpm db:generate`
Expected: a new migration file and updated meta snapshot appear under `packages/database/drizzle/`.

Edit the generated SQL so it explicitly:
- creates the enum type
- updates existing `pending` rows to `submitted`
- casts the old text column into the enum
- adds the new nullable columns

- [ ] **Step 3: Update DB seed helpers**

Modify `apps/web/tests/e2e-utils/db.ts` so `seedNurse()` can seed:
- `status` with default `verified`
- `licenseJurisdiction`
- `licenseValidUntil`

- [ ] **Step 4: Run clean-migration verification**

Run: `pnpm db:from-clean`
Expected: PASS with the new enum, backfill mapping, and columns applied from scratch.

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/schema/nurses.ts packages/database/drizzle packages/database/drizzle/meta apps/web/tests/e2e-utils/db.ts
git commit -m "feat(db): add credential state to nurses"
```

### Task 3: Extend admin audit types for credential actions

**Files:**
- Modify: `apps/web/src/server/admin/audit.ts`

- [ ] **Step 1: Add the new audit action types**

Extend `AdminAuditAction` with:
- `nurse.credential.verified`
- `nurse.credential.rejected`
- `nurse.credential.suspended`

Extend `targetEntityType` so credential actions can record against a nurse record or user record cleanly.

- [ ] **Step 2: Run the web node test lane**

Run: `pnpm --filter web test:api`
Expected: PASS or compile-driven failures move to the next task rather than silent type drift.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/server/admin/audit.ts
git commit -m "chore(audit): add nurse credential audit actions"
```

## Chunk 2: Application Flow Instead of Self-Activation

### Task 4: Rewrite `/api/me/become-nurse` into an application endpoint

**Files:**
- Modify: `apps/web/src/app/api/me/become-nurse/route.ts`
- Modify: `apps/web/tests/e2e-api/nurse.api.e2e.ts`

- [ ] **Step 1: Rewrite the failing E2E API test**

Change the current “user can become a nurse” test into:
- patient submits an application to `/api/me/become-nurse`
- response returns `{ ok: true, status: "submitted" }`
- `/api/me` still shows `role === "patient"`
- `/api/me` includes the submitted nurse application/profile state

Also update the idempotency test so the second submission updates the same nurse row without promoting the role.

- [ ] **Step 2: Run the targeted E2E API test to verify it fails**

Run: `pnpm db:from-clean && pnpm --filter web exec playwright test tests/e2e-api/nurse.api.e2e.ts --project=api --grep "submit|idempotent"`
Expected: FAIL because the route still promotes the user to `nurse`.

- [ ] **Step 3: Update the endpoint**

Change `apps/web/src/app/api/me/become-nurse/route.ts` so it:
- validates `licenseJurisdiction` in addition to `licenseNumber` and `specialization`
- does **not** update `users.role`
- creates or updates the nurse row with `status: "submitted"`
- leaves `isAvailable = false`
- returns `{ ok: true, status: "submitted" }`

- [ ] **Step 4: Re-run the targeted E2E API test**

Run: `pnpm db:from-clean && pnpm --filter web exec playwright test tests/e2e-api/nurse.api.e2e.ts --project=api --grep "submit|idempotent"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/me/become-nurse/route.ts apps/web/tests/e2e-api/nurse.api.e2e.ts
git commit -m "feat(nurse): convert self-activation into application flow"
```

### Task 5: Expose nurse application state through `/api/me`

**Files:**
- Modify: `apps/web/src/app/api/me/route.ts`
- Modify: `apps/web/src/types/me.ts`
- Modify: `apps/web/src/hooks/use-user-profile.ts`

- [ ] **Step 1: Add the failing response-shape assertion**

Extend the updated nurse API E2E test so a patient with a submitted application gets a populated nurse profile from `/api/me`, including:
- `status`
- `licenseNumber`
- `licenseJurisdiction`
- `specialization`
- `licenseValidUntil`
- `isAvailable`

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `pnpm db:from-clean && pnpm --filter web exec playwright test tests/e2e-api/nurse.api.e2e.ts --project=api --grep "submit"`
Expected: FAIL because `/api/me` only returns `nurseProfile` for `role === "nurse"`.

- [ ] **Step 3: Update `/api/me` and the client types**

Change the response contract so:
- `nurseProfile` may exist whenever a nurse row exists, even if `user.role === "patient"`
- `nurseProfile.status` and the new credential fields are included
- `profileComplete` remains based on patient profile completion for patient applicants

Update `apps/web/src/types/me.ts` and `apps/web/src/hooks/use-user-profile.ts` to match the new shape.

- [ ] **Step 4: Re-run the targeted test**

Run: `pnpm db:from-clean && pnpm --filter web exec playwright test tests/e2e-api/nurse.api.e2e.ts --project=api --grep "submit"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/me/route.ts apps/web/src/types/me.ts apps/web/src/hooks/use-user-profile.ts apps/web/tests/e2e-api/nurse.api.e2e.ts
git commit -m "feat(me): expose nurse application state"
```

### Task 6: Rework patient-facing nurse surfaces

**Files:**
- Modify: `apps/web/src/components/dashboard/become-nurse-card.tsx`
- Create: `apps/web/src/components/dashboard/nurse-application-status-card.tsx`
- Modify: `apps/web/src/app/(app)/dashboard/dashboard-client-page.tsx`
- Modify: `apps/web/src/app/(auth)/onboarding/page.tsx`
- Modify: `apps/web/src/app/profile/page.tsx`
- Modify: `apps/web/tests/e2e-ui/nurse.spec.ts`

- [ ] **Step 1: Rewrite the failing UI scenario**

Replace the existing “become nurse and toggle availability” UI test with:
- patient sees “Apply to Join as a Nurse”
- patient submits the form
- patient remains on the patient dashboard
- the apply card is replaced by an “under review” status card
- no nurse availability controls are shown

- [ ] **Step 2: Run the targeted UI test to verify it fails**

Run: `pnpm db:from-clean && pnpm --filter web exec playwright test tests/e2e-ui/nurse.spec.ts --project=ui --grep "apply"`
Expected: FAIL because the current dashboard still self-activates the user.

- [ ] **Step 3: Update the dashboard and forms**

Make these changes:
- `BecomeNurseCard` becomes an application card with `licenseJurisdiction`, new copy, and no full-page reload
- add `NurseApplicationStatusCard` for `draft`, `submitted`, `under_review`, `rejected`, `suspended`, and `expired`
- `dashboard-client-page.tsx` shows:
  - nurse dashboard only for `user.role === "nurse"` with `nurseProfile.status === "verified"`
  - application status card for patients with any nurse row
  - application card only for patients with no nurse row
- remove the nurse-specific onboarding step from `apps/web/src/app/(auth)/onboarding/page.tsx`
- make `apps/web/src/app/profile/page.tsx` read-only for role display; no `<select>`, no role mutation path

- [ ] **Step 4: Re-run the targeted UI test**

Run: `pnpm db:from-clean && pnpm --filter web exec playwright test tests/e2e-ui/nurse.spec.ts --project=ui --grep "apply"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/become-nurse-card.tsx apps/web/src/components/dashboard/nurse-application-status-card.tsx 'apps/web/src/app/(app)/dashboard/dashboard-client-page.tsx' 'apps/web/src/app/(auth)/onboarding/page.tsx' apps/web/src/app/profile/page.tsx apps/web/tests/e2e-ui/nurse.spec.ts
git commit -m "feat(ui): replace nurse self-activation with application state"
```

## Chunk 3: Admin Credential Review

### Task 7: Add admin credential review server logic and APIs

**Files:**
- Create: `apps/web/src/server/admin/nurse-credentials.ts`
- Create: `apps/web/src/app/api/admin/nurses/route.ts`
- Create: `apps/web/src/app/api/admin/nurses/[id]/verify/route.ts`
- Create: `apps/web/src/app/api/admin/nurses/[id]/reject/route.ts`
- Create: `apps/web/src/app/api/admin/nurses/[id]/suspend/route.ts`
- Create: `apps/web/tests/e2e-api/admin-nurse-credentials.api.e2e.ts`

- [ ] **Step 1: Write the failing admin E2E API test**

Cover these flows:
- admin lists submitted nurses
- admin verifies a nurse and sets `licenseValidUntil`
- verification changes `users.role` to `nurse` and sets `verifiedBy` / `verifiedAt`
- admin rejects a submitted nurse without promoting the role
- admin suspends a verified nurse and forces `isAvailable = false`

- [ ] **Step 2: Run the targeted admin E2E API test to verify it fails**

Run: `pnpm db:from-clean && pnpm --filter web exec playwright test tests/e2e-api/admin-nurse-credentials.api.e2e.ts --project=api`
Expected: FAIL because the endpoints and helper do not exist yet.

- [ ] **Step 3: Implement the server helper and routes**

Add `apps/web/src/server/admin/nurse-credentials.ts` with focused operations:
- list nurse applications and verified nurses
- verify nurse
- reject nurse
- suspend nurse

Make the routes:
- require `admin`
- validate request bodies with the new contracts
- update the nurse row
- promote `users.role` to `nurse` only on verify
- write admin audit logs with the new action types

- [ ] **Step 4: Re-run the targeted admin E2E API test**

Run: `pnpm db:from-clean && pnpm --filter web exec playwright test tests/e2e-api/admin-nurse-credentials.api.e2e.ts --project=api`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/admin/nurse-credentials.ts apps/web/src/app/api/admin/nurses apps/web/tests/e2e-api/admin-nurse-credentials.api.e2e.ts
git commit -m "feat(admin): add nurse credential review APIs"
```

### Task 8: Add admin credential review UI

**Files:**
- Create: `apps/web/src/app/admin/nurses/page.tsx`
- Create: `apps/web/src/app/admin/nurses/[id]/page.tsx`
- Create: `apps/web/src/app/admin/nurses/[id]/nurse-actions.tsx`
- Modify: `apps/web/src/app/admin/page.tsx`
- Modify: `apps/web/src/app/admin/layout.tsx`

- [ ] **Step 1: Build the review queue page**

Create `/admin/nurses` as the review queue. It should:
- list nurse rows joined with users
- default to submitted and under-review records
- show email, name, status, license number, jurisdiction, valid-until, and created-at
- link each row to a detail page

- [ ] **Step 2: Build the nurse detail page and actions**

Create `/admin/nurses/[id]` with:
- nurse credential details
- status and timestamps
- client actions for verify, reject, and suspend

- [ ] **Step 3: Wire admin navigation**

Add a “Nurse Verification Queue” link to:
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/admin/layout.tsx`

- [ ] **Step 4: Run targeted UI smoke on admin surfaces**

Run: `pnpm db:from-clean && pnpm --filter web test:e2e:ui-smoke`
Expected: PASS and no regression to existing admin smoke coverage.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/admin/nurses apps/web/src/app/admin/page.tsx apps/web/src/app/admin/layout.tsx
git commit -m "feat(admin-ui): add nurse verification queue"
```

## Chunk 4: Enforce Verified Dispatch Eligibility

### Task 9: Gate matching and reassignment on verified, in-date credentials

**Files:**
- Modify: `apps/web/src/server/requests/allocate-request.ts`
- Modify: `apps/web/src/server/requests/admin-reassign.ts`
- Modify: `apps/web/src/app/admin/requests/[id]/page.tsx`
- Modify: `apps/web/src/server/requests/allocate-request.db.test.ts`
- Modify: `apps/web/tests/e2e-api/requests.api.e2e.ts`
- Modify: `apps/web/tests/e2e-api/admin-request-reassign.api.e2e.ts`

- [ ] **Step 1: Add the failing DB and E2E assertions**

Add coverage for:
- a submitted nurse with `isAvailable = true` is not auto-assigned
- an expired verified nurse is not auto-assigned
- admin reassignment to a non-verified or expired nurse returns a validation error

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `pnpm --filter web exec vitest run -c vitest.config.node.ts src/server/requests/allocate-request.db.test.ts`
Expected: FAIL because the allocator still filters only on `is_available`.

Run: `pnpm db:from-clean && pnpm --filter web exec playwright test tests/e2e-api/requests.api.e2e.ts tests/e2e-api/admin-request-reassign.api.e2e.ts --project=api`
Expected: FAIL on the new verification-gating assertions.

- [ ] **Step 3: Update matching and reassignment**

Change `allocate-request.ts` so candidate selection requires:
- `users.role = 'nurse'`
- `nurses.status = 'verified'`
- `licenseValidUntil IS NULL OR licenseValidUntil > NOW()`
- `nurses.isAvailable = true`

Change `admin-reassign.ts` so it rejects:
- non-verified nurse records
- expired nurse credentials

Update the admin request detail page so nurse candidates visibly show status and validity.

- [ ] **Step 4: Re-run the focused tests**

Run: `pnpm --filter web exec vitest run -c vitest.config.node.ts src/server/requests/allocate-request.db.test.ts`
Expected: PASS

Run: `pnpm db:from-clean && pnpm --filter web exec playwright test tests/e2e-api/requests.api.e2e.ts tests/e2e-api/admin-request-reassign.api.e2e.ts --project=api`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/requests/allocate-request.ts apps/web/src/server/requests/admin-reassign.ts 'apps/web/src/app/admin/requests/[id]/page.tsx' apps/web/src/server/requests/allocate-request.db.test.ts apps/web/tests/e2e-api/requests.api.e2e.ts apps/web/tests/e2e-api/admin-request-reassign.api.e2e.ts
git commit -m "feat(dispatch): require verified credentials for assignment"
```

## Chunk 5: Request Intake Fields Only

### Task 10: Extend request intake without changing request lifecycle

**Files:**
- Modify: `packages/contracts/src/requests.ts`
- Modify: `packages/database/src/schema/service-requests.ts`
- Modify: `packages/database/drizzle/*`
- Modify: `packages/database/drizzle/meta/*`
- Modify: `apps/web/src/app/api/requests/route.ts`
- Modify: `apps/web/tests/e2e-api/requests.api.e2e.ts`

- [ ] **Step 1: Add the failing intake-field test**

Extend the request API tests so a create-request payload may include:
- `requestType` as `scheduled` or `same_day`
- `scheduledFor` when scheduled
- `referralSource` as `consumer` or `partner`
- nullable `referralPartnerId`
- optional `careType`

Do **not** change any assertions around request status transitions in this task.

- [ ] **Step 2: Run the targeted request API test to verify it fails**

Run: `pnpm db:from-clean && pnpm --filter web exec playwright test tests/e2e-api/requests.api.e2e.ts --project=api --grep "request"`
Expected: FAIL because the current request contract ignores the new fields.

- [ ] **Step 3: Update the contract, schema, and API**

Add the new intake fields only. Keep the existing request status enum unchanged in this slice.

Recommended DB modeling:
- `requestType` as a small enum or constrained text
- `scheduledFor` as nullable timestamp
- `referralSource` as a small enum or constrained text
- `referralPartnerId` as nullable UUID reference
- `careType` as nullable text

Wire `apps/web/src/app/api/requests/route.ts` to pass the new intake fields into request creation storage, but do not add partner-role authorization in this slice.

- [ ] **Step 4: Re-run request intake verification**

Run: `pnpm db:from-clean && pnpm --filter web exec playwright test tests/e2e-api/requests.api.e2e.ts --project=api --grep "request"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/requests.ts packages/database/src/schema/service-requests.ts packages/database/drizzle packages/database/drizzle/meta apps/web/src/app/api/requests/route.ts apps/web/tests/e2e-api/requests.api.e2e.ts
git commit -m "feat(requests): add intake fields for scheduling and referrals"
```

## Chunk 6: Full Verification

### Task 11: Run the release-oriented regression set

**Files:**
- No file changes

- [ ] **Step 1: Run clean DB bootstrap**

Run: `pnpm db:from-clean`
Expected: PASS

- [ ] **Step 2: Run contract and node test lanes**

Run: `pnpm --filter contracts test`
Expected: PASS

Run: `pnpm --filter web test:api`
Expected: PASS

- [ ] **Step 3: Run the focused API and UI suites**

Run: `pnpm db:from-clean && pnpm --filter web exec playwright test tests/e2e-api/nurse.api.e2e.ts tests/e2e-api/admin-nurse-credentials.api.e2e.ts tests/e2e-api/requests.api.e2e.ts tests/e2e-api/admin-request-reassign.api.e2e.ts --project=api`
Expected: PASS

Run: `pnpm db:from-clean && pnpm --filter web exec playwright test tests/e2e-ui/nurse.spec.ts --project=ui`
Expected: PASS

- [ ] **Step 4: Run repo gates**

Run: `pnpm gate:fast`
Expected: PASS

Run: `pnpm gate:e2e-api`
Expected: PASS

- [ ] **Step 5: Final commit**

```bash
git status --short
git add -A
git commit -m "feat: enforce blueprint brownfield corrections"
```

Plan complete and saved to `docs/superpowers/plans/2026-04-13-brownfield-corrections.md`. Ready to execute.
