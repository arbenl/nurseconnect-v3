# Auth Cutover Protocol (Phase 2)

## Overview
We are migrating from **Firebase Auth + NextAuth** to **Better-Auth** (PostgreSQL).
To ensure zero downtime and safe verification, we use a feature flag `FEATURE_AUTH_PROVIDER`.

## Current State (Dual Stack)
- **NextAuth** (Legacy): Active on `/api/auth/[...nextauth]`
- **Better-Auth** (New): Active on `/api/better-auth/*`
- **Application Logic**: Controlled by `FEATURE_AUTH_PROVIDER` (default: `nextauth`)

## Cutover Steps

### 1. Preparation (Done)
- [x] Better-Auth installed & configured
- [x] Identity bootstrap via `/api/me`
- [x] Admin bootstrap via `/api/admin/ping`
- [x] Feature flag implemented

### 2. Backfill (Next Step)
- [ ] Export users from Firebase Auth
- [ ] Run `scripts/backfill-users.ts` to populate PostgreSQL `auth_users` table
- [ ] Verify user counts

### 3. Verification
- [ ] Set `FEATURE_AUTH_PROVIDER=betterauth` locally
- [ ] Login via Better-Auth flow
- [ ] Verify `/api/me` returns bootstrapped user
- [ ] Verify Protected Routes (RBAC) work

### 4. Production Cutover
1. Deploy with `FEATURE_AUTH_PROVIDER=nextauth` (No change)
2. Run Backfill script in Production
3. Update Env: `FEATURE_AUTH_PROVIDER=betterauth`
4. Redeploy / Restart

### 5. Rollback Plan
If critical issues occur:
1. Revert Env: `FEATURE_AUTH_PROVIDER=nextauth`
2. Redeploy
3. Users fall back to Firebase Auth (sessions may need re-login)

## Cleanup (Post-Cutover)
- Remove `NEXT_PUBLIC_FIREBASE_*` keys
- Remove `apps/web/src/legacy/firebase`
- Remove `next-auth` dependency
- Delete `/api/auth/[...nextauth]` route
