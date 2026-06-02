# Identity Auth Bridge Runbook

## Purpose

NurseConnect uses Better-Auth as the authentication source of truth and `users` as the domain identity projection. The bridge is `users.auth_id -> auth_users.id`.

`NC-E0-01` makes this bridge observable and testable before tenant membership, SSO, SCIM, RLS, or CRM primitives depend on it.

## Current Policy

- `users.auth_id IS NULL` is allowed only for pre-auth patient/referral invite shell rows.
- `users.auth_id` pointing to no `auth_users.id` is invalid and must be fixed before FK enforcement.
- `auth_users.id` with no matching `users.auth_id` is temporarily tolerated; `resolveSessionUser` must create or claim the domain projection on first authenticated app access.
- Duplicate `users.auth_id` is invalid and remains blocked by the existing unique index.
- Pre-auth shell rows may be claimed only by an auth user whose email is verified.
- Multiple unauthenticated shell rows with the same email are ambiguous and must be remediated before claim.

## Reconciliation

Run:

```bash
pnpm identity:reconcile -- --json
```

The default report redacts row identifiers. For local-only investigation, use:

```bash
pnpm identity:reconcile -- --json --include-identifiers
```

Do not paste identifier-bearing output into PRs, model-review packets, screenshots, or public evidence.

`missingDomainUsers` samples show `role: null` because the domain `users` projection does not exist yet.

After `pnpm db:from-clean`, the expected local baseline is:

- `shellUsers=0`
- `missingAuthUsers=0`
- `missingDomainUsers=0`

## Staged Enforcement Plan

1. Observe the three reconciliation categories in local/staging evidence.
2. Fix `users.auth_id` values that do not point at `auth_users.id`.
3. Move pre-auth invite shells to a dedicated lifecycle or make their exemption explicit.
4. Add FK enforcement from `users.auth_id` to `auth_users.id` when missing-auth rows are zero.
5. Add `NOT NULL` only after shell users are zero or no longer stored in `users`.

`FIRST_ADMIN_EMAILS` bootstrap is intended only for early admin creation, requires a verified auth email, and must be removed or gated before multi-tenant launch roles become authoritative.

## Rollback

Rollback is code-only for this slice: remove `identity:reconcile`, `scripts/identity/reconcile-auth-bridge.mjs`, the focused tests, and this runbook. No database migration rollback is required.

## Verification

Focused checks:

```bash
pnpm test:scripts -- identity-reconcile-auth-bridge
pnpm --filter @nurseconnect/domain-identity test:db
```

Slice checks:

```bash
pnpm verify-slice
pnpm verify-slice -- --run-root <run_root> --static
pnpm verify-slice -- --run-root <run_root> --required-gates
```
