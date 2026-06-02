# ADR-002: Identity Model

**Status:** Proposed
**Date:** 2026-06-02
**Related:** ADR-001 (tenancy), ADR-003 (authz); report §2.5, §3 R2, §9 Phase 0/1

## Context

NurseConnect has **two identity stores**:
- Better-Auth tables keyed by `text` id: `auth_users`, `auth_sessions`, `auth_accounts`, `auth_verifications` (`packages/database/src/schema/auth.ts`), configured in `apps/web/src/lib/auth.ts` (email+password, `autoSignIn: true`, `requireEmailVerification: false`).
- A domain `users` table keyed by `uuid`, with role and profile (`packages/database/src/schema/users.ts`).

The bridge is a **nullable** `users.auth_id` (`uniqueIndex`, but nullable). Two sources of truth for "who is this person," joined by a nullable text column, is a correctness and security liability (report R2): a null or mismatched `auth_id` is a silent authz hole, and it is a poor base for SSO/SCIM/org-membership.

## Decision Drivers

- One unambiguous "current user" per request.
- Clean foundation for org membership (ADR-001), SSO/SCIM, and MFA.
- Minimal disruption to the working Better-Auth flow.

## Options

1. **Keep dual store, enforce the link.** Make `users.auth_id` non-null + FK to `auth_users.id`; reconcile orphans; add an invariant test. Lowest effort.
2. **Better-Auth as system of record, `users` as projection.** Better-Auth owns authentication; domain `users` is a derived profile/role projection with an enforced, non-null FK and a single resolver (`resolveCurrentSessionUser`) as the only path to "current user." Org membership hangs off the domain user.
3. **Collapse to a single table/keyspace.** Merge auth and domain users into one identity. Cleanest model, largest migration, fights Better-Auth's adapter expectations.

## Decision (recommended)

**Option 2.** Better-Auth remains the authentication system of record; domain `users` becomes the canonical *domain projection* of identity, linked by a **non-null, FK-enforced** `auth_id`. All authorization resolves identity through one function (today: `apps/web/src/server/auth/session-user.ts` → `resolveCurrentSessionUser`); forbid any other path. Org membership (ADR-001) attaches to the domain user, not the auth user.

Phase the work: the **non-null + FK + reconciliation** hardening is a Phase 0 quick win (cheap, closes the hole now); the projection discipline and SSO/SCIM hooks land in Phase 1/3.

Rationale: Option 1 alone leaves two competing identities; Option 3's full merge is unnecessary risk given Better-Auth works. Option 2 gives one source of truth for *authn* and one for *domain identity* with an enforced bridge — enough to build org membership and SSO on, without a risky keyspace migration.

## Consequences

**Positive:** eliminates the nullable-link authz hole; single resolver; clean base for SSO/SCIM and org membership; production email verification on.

**Negative / costs:** backfill + orphan reconciliation before the column can be non-null; a guard (lint/test) to prevent bypassing the resolver; SSO/SCIM still a later effort.

## Verification

- `*.db.test.ts`: no `users` row has null `auth_id`; every `auth_id` references an existing `auth_users.id` (and vice-versa where required).
- Test that `requireRole`/`requireAnyRole` resolve identity only via `resolveCurrentSessionUser`.
- Auth e2e still green after `requireEmailVerification: true` in production config.

## Open items

- Orphan policy: what to do with domain users lacking an auth row (and vice-versa) discovered during backfill.
- SSO protocol priority (OIDC vs SAML) for first enterprise customer (Phase 3).
