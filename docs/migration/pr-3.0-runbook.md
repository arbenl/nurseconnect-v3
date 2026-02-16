# PR-3.0: Full Cutover Runbook

This runbook guides the transition from `NextAuth` to `Better-Auth` as the primary authentication provider.

## 0. Pre-Flight Checks (Hard Gates)
**STOP** if any of these fail. Do not proceed to flip flag.

1.  **Code Health**:
    ```bash
    pnpm type-check && echo "✅ Types OK" || echo "❌ Types FAILED"
    # Must exit 0
    ```
2.  **Env Health**:
    ```bash
    pnpm tsx scripts/env-check.mjs && echo "✅ Env OK" || echo "❌ Env FAILED"
    # Must exit 0
    ```
3.  **Database Connectivity**:
    ```bash
    curl -s http://localhost:3000/api/health/db | grep '"db":"ok"' && echo "✅ DB OK" || echo "❌ DB FAILED"
    ```
4.  **Baseline Functionality (NextAuth)**:
    - [ ] `/smoke/auth` loads (Status 200).
    - [ ] `/admin` loads (Status 200) for admin user.
5.  **Backfill Dry-Run**:
    ```bash
    pnpm tsx scripts/backfill-users.ts --input tmp/firebase-users.json
    ```
    - [ ] Errors must be `0`.
    - [ ] Conflicts must be `0` (or explicitly documented/accepted).
6.  **Codebase Baselines (Record These)**:
    ```bash
    echo "NextAuth Uses: $(rg -n "next-auth" apps/web/src | wc -l)"
    echo "Firebase Uses: $(rg -n "firebase" apps/web/src | wc -l)"
    ```
7.  **Route Collision Check (Gotcha)**:
    Ensure no NextAuth route conflicts with Better-Auth's prefix.
    ```bash
    rg -n "\/api\/auth" apps/web/src/app/api | head
    rg -n "better-auth" apps/web/src/app/api -S
    # Ensure they don't fight for the same base path.
    ```

## 1. Backfill Execution
**Goal**: Populate Postgres `users` table with identity data from Firebase.

1.  **Apply**:
    ```bash
    pnpm tsx scripts/backfill-users.ts --input tmp/firebase-users.json --apply
    ```
2.  **Verify**: Check that `inserted` count matches expected new users.

## 2. Cutover & Rollback Drill
**Goal**: Prove reversibility before committing.

1.  **Flip to Better-Auth**:
    Edit `.env.local`: `FEATURE_AUTH_PROVIDER=betterauth`
    Restart server.
2.  **Verify New State**:
    - [ ] `/smoke/auth` -> Better-Auth session active.
    - [ ] `/admin` -> Works via Better-Auth.
3.  **Flip Back (Rollback Drill)**:
    Edit `.env.local`: `FEATURE_AUTH_PROVIDER=nextauth`
    Restart server.
4.  **Verify Old State**:
    - [ ] `/smoke/auth` -> NextAuth session active.
    - [ ] `/admin` -> Works via NextAuth.
5.  **Commit to Better-Auth**:
    Edit `.env.local`: `FEATURE_AUTH_PROVIDER=betterauth`
    Restart server.

## 3. Final Verification
**Goal**: Confirm Critical User Journeys (CUJs).

1.  **Smoke Test**:
    - Visit `http://localhost:3000/smoke/auth`
    - Login via Better-Auth.
    - Confirm `/api/me` returns `{ user: { id: "...", role: "..." } }`.
    - Confirm `/api/admin/ping` returns expected status.

2.  **Admin Dashboard**:
    - Visit `http://localhost:3000/admin`
    - Navigate to **Users**.
    - Try promoting/demoting a test user.

3.  **Regression Check**:
    - Check public pages (Home, Sign In options).

## 4. Emergency Rollback Plan
If **ANY** critical issue arises in production or staging:

1.  Edit server env: `FEATURE_AUTH_PROVIDER=nextauth`
2.  Redeploy/Restart.
3.  You are back to the stable legacy state.

## 5. Post-Execution Report
Pause feature work. Execute this runbook locally. Return with this exact template:

```markdown
### PR-3.0 Verification Outcomes

**A) Pre-flight gates**
- pnpm install ✅/❌ (if ❌, paste error)
- pnpm type-check ✅/❌
- pnpm env:check ✅/❌
- curl -s http://localhost:3000/api/health/db → (paste output)
- pnpm db:generate ✅/❌
- pnpm db:migrate ✅/❌

**B) Baseline counts (before backfill & flip)**
- `rg -n "next-auth" apps/web/src | wc -l` → _____
- `rg -n "firebase" apps/web/src | wc -l` → _____

**C) Backfill**
- Command used:
  - dry-run: _____
  - apply: _____
- Report summary:
  - inserted: _____
  - linked: _____
  - updated: _____
  - skipped: _____
  - conflicts: _____
  - errors: _____
  - Notes on conflicts/errors (if any): _____

**D) NextAuth mode verification (FEATURE_AUTH_PROVIDER=nextauth)**
- `/smoke/auth` ✅/❌
- `/api/me` (paste JSON): _____
- `/api/admin/ping` (status + JSON): _____
- `/admin` loads as admin ✅/❌
- Promote/demote role works ✅/❌

**E) Better-Auth mode verification (FEATURE_AUTH_PROVIDER=betterauth)**
- `/smoke/auth` ✅/❌
- `/api/me` (paste JSON): _____
- `/api/admin/ping` (status + JSON): _____
- `/admin` loads as admin ✅/❌
- Promote/demote role works ✅/❌

**F) Rollback drill**
- Flip nextauth → betterauth → nextauth works ✅/❌
- After rollback, `/admin` still works ✅/❌
- Any regressions noticed: _____
```

When verified, we proceed to **PR-3.1A: Remove NextAuth**.
