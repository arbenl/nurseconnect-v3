# Data Source Map

> **Firebase is not used in V3.** Any Firebase-related environment variables (`NEXT_PUBLIC_FIREBASE_*`, `FIRESTORE_EMULATOR_HOST`, `NEXT_PUBLIC_USE_EMULATORS`) are **rejected at boot time**. The env validation in `apps/web/src/env.ts` will throw if any are present.

> For any slice, **at most one backend is the source of truth**. If reads differ from writes, it is explicitly in "read-first" migration mode, and the feature flag must be documented.

| Domain Area | Source of Truth | Feature Flag | Status |
|---|---|---|---|
| Auth / identity | Better-Auth + Postgres | — | Phase 2 |
| Nurse profiles | Postgres | `FEATURE_BACKEND_NURSE_PROFILE` | Not started |
| Patient profiles | Postgres | `FEATURE_BACKEND_PATIENT_PROFILE` | Not started |
| Service requests | Postgres | `FEATURE_BACKEND_SERVICE_REQUEST` | Not started |
| Assignments | Postgres | `FEATURE_BACKEND_ASSIGNMENT` | Not started |
| Visits | Postgres | `FEATURE_BACKEND_VISIT` | Not started |

## How to Use This Table

1. **Before coding**, check which backend owns the data you're touching.
2. **All slices use Postgres.** There is no Firebase path in V3.
3. Feature flags exist to gate rollout of individual slices, not to toggle between backends.

## Known Mismatches (Legacy)

- **Auth**: `middleware.ts` still references `next-auth/jwt`. Phase 2 will replace this with Better-Auth middleware. Do not add new NextAuth code.
- **Firebase imports**: Some legacy files may still import `firebase` or `firebase-admin`. These are dead code and will be removed in Phase 3 cleanup.
