# Domain Identity User Expansion Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand `@nurseconnect/domain-identity` so it owns domain-user bootstrap, profile update policy, `/api/me` projection shaping, and admin role-change policy without pulling Better-Auth, nurse profile mutation, or audit writes into the package.

**Architecture:** Keep this slice behavior-preserving and package-first. `@nurseconnect/domain-identity` becomes the authoritative home for user bootstrap/upsert, base profile completion rules, derived self-profile completeness, and role-change side-effect descriptors. `apps/web` remains the adapter/orchestration layer: it keeps `getSession(...)`, `requireRole(...)`, request parsing, `NextResponse`, DB transaction composition, and `recordAdminAction(...)`.

**Tech Stack:** pnpm workspaces, Turborepo, TypeScript, Next.js App Router, Drizzle/Postgres, Vitest, Playwright, `@nurseconnect/database`, `@nurseconnect/domain-nurse`, `@nurseconnect/domain-identity`, `zod`

---

## File Structure

### Domain package additions and reshaping

- Create: `packages/domain-identity/src/domain-user.ts`
- Create: `packages/domain-identity/src/domain-user.db.test.ts`
- Create: `packages/domain-identity/src/profile-policy.ts`
- Create: `packages/domain-identity/src/profile-policy.test.ts`
- Create: `packages/domain-identity/src/me-projection.ts`
- Create: `packages/domain-identity/src/me-projection.test.ts`
- Create: `packages/domain-identity/src/admin-role-policy.ts`
- Create: `packages/domain-identity/src/admin-role-policy.test.ts`
- Modify: `packages/domain-identity/package.json`
- Modify: `packages/domain-identity/src/index.ts`
- Modify: `packages/domain-identity/src/errors.ts`
- Modify: `packages/domain-identity/src/session-user.ts`
- Delete: `packages/domain-identity/src/user-projection.ts`

### App adapters that cut over to the package

- Modify: `apps/web/src/app/api/me/route.ts`
- Modify: `apps/web/src/app/api/me/profile/route.ts`
- Modify: `apps/web/src/app/api/me/nurse/route.ts`
- Modify: `apps/web/src/app/api/me/become-nurse/route.ts`
- Modify: `apps/web/src/app/api/admin/users/[id]/role/route.ts`
- Modify: `apps/web/src/server/auth/portal-access.ts`

### Regression coverage and obsolete app-local files

- Create: `apps/web/tests/e2e-api/me-profile.api.e2e.ts`
- Create: `apps/web/tests/e2e-api/admin-users.api.e2e.ts`
- Delete: `apps/web/src/lib/user-service.ts`
- Delete: `apps/web/src/server/auth/user-service.db.test.ts`
- Modify: `pnpm-lock.yaml`

### Deliberate non-goals for this plan

- Do not redesign `apps/web/src/app/api/profile/route.ts`
- Do not move Better-Auth integration out of `apps/web`
- Do not create or mutate nurse records during admin role changes
- Do not move `apps/web/src/app/api/me/nurse/route.ts` or `apps/web/src/app/api/me/become-nurse/route.ts` business logic beyond cutting their bootstrap import over to the package
- Do not refactor onboarding or dashboard UI flows
- Do not create a new `@nurseconnect/domain-users` package

## Execution Strategy

- Start from a fresh dedicated worktree off merged `main`, not from the design branch.
- Extract the already-partial `ensureDomainUserFromSession(...)` and `maybeBootstrapFirstAdmin(...)` ownership first so `apps/web/src/lib/user-service.ts` can be removed instead of becoming a long-lived shim.
- Add `zod` to `@nurseconnect/domain-identity` before introducing `profile-policy.ts`.
- Keep `profileCompletedAt` and derived `profileComplete` distinct:
  - `profile-policy.ts` owns the persisted base-profile completion timestamp.
  - `me-projection.ts` owns derived readiness for `/api/me` and portal access.
- Reuse one derived completion helper from `me-projection.ts` inside `apps/web/src/server/auth/portal-access.ts` so onboarding redirects and `/api/me` never drift.
- Keep admin role auditing in `apps/web`: `admin-role-policy.ts` returns `IdentitySideEffect[]`; the route fulfills them inside the existing transaction.
- Add focused API E2E coverage for `/api/me/profile` and `/api/admin/users/[id]/role` because the current repo does not have route-specific regression tests for those seams.

## Chunk 1: Extract Domain-User Bootstrap and Remove `apps/web` User Shim

### Task 1: Move bootstrap/upsert into `packages/domain-identity/src/domain-user.ts`

**Files:**
- Create: `packages/domain-identity/src/domain-user.ts`
- Create: `packages/domain-identity/src/domain-user.db.test.ts`
- Modify: `packages/domain-identity/src/index.ts`
- Modify: `packages/domain-identity/src/session-user.ts`
- Modify: `apps/web/src/app/api/me/route.ts`
- Modify: `apps/web/src/app/api/me/nurse/route.ts`
- Modify: `apps/web/src/app/api/me/become-nurse/route.ts`
- Delete: `packages/domain-identity/src/user-projection.ts`
- Delete: `apps/web/src/lib/user-service.ts`
- Delete: `apps/web/src/server/auth/user-service.db.test.ts`

- [ ] **Step 1: Copy the existing DB coverage into the package and make it fail there**

Create `packages/domain-identity/src/domain-user.db.test.ts` by moving the assertions from `apps/web/src/server/auth/user-service.db.test.ts` and updating imports to the new package-local module:

```ts
import { maybeBootstrapFirstAdmin, ensureDomainUserFromSession } from "./domain-user";

it("promotes an allowlisted first admin", async () => {
  process.env.FIRST_ADMIN_EMAILS = "admin@example.com";

  const user = await ensureDomainUserFromSession({
    id: "auth_admin_1",
    email: "admin@example.com",
    name: "Admin User",
  });

  const result = await maybeBootstrapFirstAdmin(user);
  expect(result.role).toBe("admin");
});
```

Keep the current five cases:
- no promotion when `FIRST_ADMIN_EMAILS` is unset
- no promotion when the email is absent from the allowlist
- promotion when the email matches case-insensitively
- unchanged return when the user is already admin
- interim nurse-record adapter smoke still works through `@nurseconnect/domain-nurse`

- [ ] **Step 2: Run the red phase**

Run:

```bash
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter @nurseconnect/domain-identity exec vitest run --config vitest.config.ts src/domain-user.db.test.ts
```

Expected: FAIL because `./domain-user` does not exist yet.

- [ ] **Step 3: Create `domain-user.ts` and cut package exports over**

Move the existing logic from `packages/domain-identity/src/user-projection.ts` into `packages/domain-identity/src/domain-user.ts`:

```ts
export async function ensureDomainUserFromSession(data: SessionUserProjectionInput) {
  // existing insert/onConflictDoUpdate behavior
}

export async function maybeBootstrapFirstAdmin(domainUser: DomainUser) {
  // existing FIRST_ADMIN_EMAILS allowlist behavior
}
```

Then update:
- `packages/domain-identity/src/session-user.ts` to import from `./domain-user`
- `packages/domain-identity/src/index.ts` to export `./domain-user`

Do not change the bootstrap semantics in this chunk.

- [ ] **Step 4: Cut the app consumers to `@nurseconnect/domain-identity` and remove the shim**

Update imports in:
- `apps/web/src/app/api/me/route.ts`
- `apps/web/src/app/api/me/nurse/route.ts`
- `apps/web/src/app/api/me/become-nurse/route.ts`

From:

```ts
import { ensureDomainUserFromSession, maybeBootstrapFirstAdmin } from "@/lib/user-service";
```

To:

```ts
import { ensureDomainUserFromSession, maybeBootstrapFirstAdmin } from "@nurseconnect/domain-identity";
```

Then delete:
- `apps/web/src/lib/user-service.ts`
- `apps/web/src/server/auth/user-service.db.test.ts`
- `packages/domain-identity/src/user-projection.ts`

- [ ] **Step 5: Verify bootstrap behavior still holds**

Run:

```bash
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter @nurseconnect/domain-identity exec vitest run --config vitest.config.ts src/domain-user.db.test.ts
pnpm type-check
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/auth.api.e2e.ts tests/e2e-api/authz.api.e2e.ts --project=api
```

Expected:
- package DB test passes
- `resolveSessionUser(...)` still upserts the domain user
- `/api/me`, `/api/me/nurse`, and `/api/me/become-nurse` still resolve the user through the package
- auth/authz API smoke remains green

- [ ] **Step 6: Commit**

```bash
git add packages/domain-identity apps/web/src/app/api/me/route.ts apps/web/src/app/api/me/nurse/route.ts apps/web/src/app/api/me/become-nurse/route.ts
git commit -m "refactor: extract identity domain user bootstrap"
```

## Chunk 2: Extract Profile Policy and `/me` Projection

### Task 2: Move base profile completion and self-profile shaping into the package

**Files:**
- Create: `packages/domain-identity/src/profile-policy.ts`
- Create: `packages/domain-identity/src/profile-policy.test.ts`
- Create: `packages/domain-identity/src/me-projection.ts`
- Create: `packages/domain-identity/src/me-projection.test.ts`
- Modify: `packages/domain-identity/package.json`
- Modify: `packages/domain-identity/src/index.ts`
- Modify: `packages/domain-identity/src/errors.ts`
- Modify: `apps/web/src/app/api/me/route.ts`
- Modify: `apps/web/src/app/api/me/profile/route.ts`
- Modify: `apps/web/src/server/auth/portal-access.ts`
- Create: `apps/web/tests/e2e-api/me-profile.api.e2e.ts`

- [ ] **Step 1: Add failing package tests for base completion and derived readiness**

Create `packages/domain-identity/src/profile-policy.test.ts` with cases like:

```ts
it("marks the base profile complete when firstName, lastName, phone, and city are present", () => {
  const result = buildProfileUpdatePatch({
    firstName: "Pat",
    lastName: "Ient",
    phone: "+38344123456",
    city: "Pristina",
    address: "Main Street 1",
  });

  expect(result.profileCompletedAt).toBeInstanceOf(Date);
});
```

Also add:
- whitespace normalization for optional address
- empty required field rejection through `ProfileValidationError`

Create `packages/domain-identity/src/me-projection.test.ts` with cases like:

```ts
it("treats a nurse with a complete base profile but missing nurse fields as not profile-complete", () => {
  const result = buildMeUserProjection(userFixture("nurse"), null);
  expect(result.profileComplete).toBe(false);
});
```

Cover:
- patient completeness follows base identity fields only
- nurse completeness also requires `licenseNumber` and `specialization`
- the exported derived-completion helper returns the same boolean used by the final projection

- [ ] **Step 2: Add focused failing API coverage for `/api/me/profile`**

Create `apps/web/tests/e2e-api/me-profile.api.e2e.ts` with two API tests:

```ts
test("patching /api/me/profile persists base fields and returns profileComplete true for a patient", async ({ request }) => {
  // create + login patient
  // PATCH /api/me/profile
  // GET /api/me
  // assert /api/me returns profileComplete: true
  // assert users.profileCompletedAt was set in the database
});

test("a nurse can have base profile complete while derived /api/me profileComplete stays false until nurse fields exist", async ({ request }) => {
  // create + login nurse with no nurse profile snapshot
  // PATCH /api/me/profile
  // GET /api/me
  // assert returned user.profileComplete === false
});
```

Use `createTestUser(...)`, `loginTestUser(...)`, and direct DB seeding from `apps/web/tests/e2e-utils/db.ts` where needed.

- [ ] **Step 3: Run the red phase**

Run:

```bash
pnpm --filter @nurseconnect/domain-identity exec vitest run --config vitest.config.ts src/profile-policy.test.ts src/me-projection.test.ts
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/me-profile.api.e2e.ts --project=api
```

Expected:
- package tests fail because the new modules and errors do not exist
- API test fails because `/api/me/profile` and `/api/me` still compute everything inline

- [ ] **Step 4: Implement `profile-policy.ts`, `me-projection.ts`, and supporting errors**

Modify `packages/domain-identity/package.json` to add:

```json
"zod": "^4.0.17"
```

Add to `packages/domain-identity/src/errors.ts`:

```ts
export class ProfileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfileValidationError";
  }
}
```

Implement `packages/domain-identity/src/profile-policy.ts` with:
- a `zod` schema for the accepted base-profile patch
- normalization for string fields
- `buildProfileUpdatePatch(...)` returning the `users` update patch, including `profileCompletedAt`

Implement `packages/domain-identity/src/me-projection.ts` with:
- an exported derived helper such as `isUserPortalProfileComplete(...)`
- an exported projection helper such as `buildMeUserProjection(...)`

Keep the current `/api/me` response shape exactly the same:
- `ok`
- `session`
- `user.profile`
- `user.nurseProfile`
- `user.profileComplete`

- [ ] **Step 5: Cut the app routes and portal-access helper over**

Update `apps/web/src/app/api/me/profile/route.ts`:
- route still does `getSession()`, `req.json()`, DB update, and `NextResponse`
- route now calls `buildProfileUpdatePatch(...)`
- route maps `ProfileValidationError` to the existing `400` validation response

Update `apps/web/src/app/api/me/route.ts`:
- keep `getSession()`
- keep optional nurse fetch via `getNurseByUserId(...)`
- replace inline profile building/completeness logic with `buildMeUserProjection(...)`

Update `apps/web/src/server/auth/portal-access.ts`:
- remove the duplicated `isProfileComplete(...)`
- import and reuse the derived completion helper from `@nurseconnect/domain-identity`
- keep route resolution and `redirect(...)` behavior in `apps/web`

- [ ] **Step 6: Verify base profile and derived completeness behavior**

Run:

```bash
pnpm --filter @nurseconnect/domain-identity exec vitest run --config vitest.config.ts src/profile-policy.test.ts src/me-projection.test.ts src/portal-access-policy.test.ts src/require-role.test.ts
pnpm type-check
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/me-profile.api.e2e.ts tests/e2e-api/auth.api.e2e.ts --project=api
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-ui/onboarding.spec.ts tests/e2e-ui/dashboard-ux.spec.ts --project=ui
```

Expected:
- package tests prove the persisted vs derived completion split
- `/api/me/profile` still updates the same fields and status codes
- `/api/me` still returns the same shape
- onboarding redirect behavior remains consistent with `/api/me`

- [ ] **Step 7: Commit**

```bash
git add packages/domain-identity apps/web/src/app/api/me/route.ts apps/web/src/app/api/me/profile/route.ts apps/web/src/server/auth/portal-access.ts apps/web/tests/e2e-api/me-profile.api.e2e.ts pnpm-lock.yaml
git commit -m "feat: extract identity profile and me projection"
```

## Chunk 3: Extract Admin Role Policy and Route-Side Audit Fulfillment

### Task 3: Move role-change invariants into `admin-role-policy.ts`

**Files:**
- Create: `packages/domain-identity/src/admin-role-policy.ts`
- Create: `packages/domain-identity/src/admin-role-policy.test.ts`
- Modify: `packages/domain-identity/src/index.ts`
- Modify: `packages/domain-identity/src/errors.ts`
- Modify: `apps/web/src/app/api/admin/users/[id]/role/route.ts`
- Create: `apps/web/tests/e2e-api/admin-users.api.e2e.ts`

- [ ] **Step 1: Write the failing package policy tests**

Create `packages/domain-identity/src/admin-role-policy.test.ts` with cases like:

```ts
it("returns unchanged when the requested role already matches the target user", () => {
  const result = planUserRoleChange({
    targetUser: userFixture({ role: "patient" }),
    nextRole: "patient",
  });

  expect(result.unchanged).toBe(true);
  expect(result.sideEffects).toEqual([]);
});
```

Also cover:
- valid transition returns a patch with the next role
- valid transition emits one `admin-audit` side effect with `previousRole`, `nextRole`, and `targetEmail`
- invalid role-change input throws `RoleChangeValidationError`

- [ ] **Step 2: Add failing route-level regression coverage**

Create `apps/web/tests/e2e-api/admin-users.api.e2e.ts` with two API tests:

```ts
test("admin can change a user's role and the audit row is written", async ({ request }) => {
  // create admin + patient
  // login admin
  // POST /api/admin/users/:id/role
  // assert users.role changed in DB
  // assert admin_audit_logs contains action user.role.changed
});

test("posting the same role returns unchanged true and does not duplicate the audit row", async ({ request }) => {
  // create admin + patient
  // login admin
  // POST same role
  // assert { ok: true, unchanged: true }
  // assert no new audit row
});
```

Use `getDbClient()` from `apps/web/tests/e2e-utils/db.ts` for the audit assertions.

- [ ] **Step 3: Run the red phase**

Run:

```bash
pnpm --filter @nurseconnect/domain-identity exec vitest run --config vitest.config.ts src/admin-role-policy.test.ts
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/admin-users.api.e2e.ts --project=api
```

Expected:
- package test fails because `planUserRoleChange(...)` and `RoleChangeValidationError` do not exist
- API test fails because the route still owns the policy inline

- [ ] **Step 4: Implement `admin-role-policy.ts` and error types**

Add to `packages/domain-identity/src/errors.ts`:

```ts
export class RoleChangeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoleChangeValidationError";
  }
}

export class UserNotFoundError extends Error {
  constructor(message = "User not found") {
    super(message);
    this.name = "UserNotFoundError";
  }
}
```

Implement `packages/domain-identity/src/admin-role-policy.ts` around a pure planner:

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

export function planUserRoleChange(...) {
  // unchanged shortcut
  // return patch + sideEffects when the role changes
}
```

- [ ] **Step 5: Cut the admin role route to the package and keep audit fulfillment in-app**

Update `apps/web/src/app/api/admin/users/[id]/role/route.ts` so it:
- keeps `requireRole("admin")`
- keeps the target-user DB lookup
- keeps the transaction
- calls `planUserRoleChange(...)`
- fulfills the returned `admin-audit` side effect with `recordAdminAction(...)`

The route should preserve the current HTTP surface:
- `400` for invalid role input
- `404` when the target user is missing
- `{ ok: true, unchanged: true }` when no mutation is needed
- `{ ok: true }` when the role changes

Do not create or mutate a nurse record when the next role is `"nurse"`.

- [ ] **Step 6: Verify role-change policy and route behavior**

Run:

```bash
pnpm --filter @nurseconnect/domain-identity exec vitest run --config vitest.config.ts src/admin-role-policy.test.ts src/profile-policy.test.ts src/me-projection.test.ts src/domain-user.db.test.ts
pnpm type-check
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/admin-users.api.e2e.ts tests/e2e-api/authz.api.e2e.ts --project=api
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-ui/auth.spec.ts --project=ui
```

Expected:
- package policy tests pass
- admin role changes still persist and emit the same audit write
- unchanged role requests stay no-op
- existing authz behavior remains intact

- [ ] **Step 7: Commit**

```bash
git add packages/domain-identity apps/web/src/app/api/admin/users/[id]/role/route.ts apps/web/tests/e2e-api/admin-users.api.e2e.ts pnpm-lock.yaml
git commit -m "feat: extract identity admin role policy"
```

## Final Verification

- [ ] **Step 1: Run the full slice verification**

Run:

```bash
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter @nurseconnect/domain-identity test
pnpm type-check
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-api/auth.api.e2e.ts tests/e2e-api/authz.api.e2e.ts tests/e2e-api/me-profile.api.e2e.ts tests/e2e-api/admin-users.api.e2e.ts --project=api
APP_URL=http://localhost:3010 BETTER_AUTH_URL=http://localhost:3010 DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web exec playwright test tests/e2e-ui/auth.spec.ts tests/e2e-ui/onboarding.spec.ts tests/e2e-ui/dashboard-ux.spec.ts --project=ui
DATABASE_URL=postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test pnpm --filter web build
```

Expected:
- `@nurseconnect/domain-identity` package tests pass, including the new DB-backed bootstrap coverage
- `/api/me`, `/api/me/profile`, and `/api/admin/users/[id]/role` preserve their HTTP behavior
- onboarding/dashboard gating still matches the shared derived completion helper
- `apps/web` build succeeds with the new package boundary

- [ ] **Step 2: Prepare publish flow**

```bash
git status
git log --oneline --decorate -5
```

Expected:
- working tree is clean
- commits map cleanly to the three chunks above

Plan complete and saved to `docs/superpowers/plans/2026-04-17-domain-identity-user-expansion.md`. Ready to execute?
