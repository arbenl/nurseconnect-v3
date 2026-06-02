# Email Verification Rollout

Scope: `NC-E0-02 / production-email-verification`.

## Source Of Truth

`auth_users.email_verified` and `auth_users.email_verified_at` are authoritative. Domain users map to auth users through `users.auth_id`.

## Modes

- `off`: development/test only. Rejected in production.
- `observe`: production rollout mode. Verification emails are enabled and unverified access is logged, but access is not denied.
- `enforce`: production target mode. Unverified auth users are denied protected app access.

## Production Requirements

- `NC_EMAIL_VERIFICATION_MODE=observe` or `enforce`
- `EMAIL_PROVIDER=postmark`
- `EMAIL_FROM=<verified sender email>`
- `POSTMARK_SERVER_TOKEN=<secret>`
- `APP_URL` or `BETTER_AUTH_URL` with `https://`

## Rollout

1. Deploy with `NC_EMAIL_VERIFICATION_MODE=observe`.
2. Run `pnpm auth:email-verification-report` and record aggregate counts only.
3. Backfill operator-approved users with `pnpm auth:email-verification-backfill -- --allowlist-file <path>`.
4. Monitor PHI-free unverified-access telemetry and provider send failures.
5. Switch to `NC_EMAIL_VERIFICATION_MODE=enforce`.

## Rollback

1. Set `NC_EMAIL_VERIFICATION_MODE=observe`.
2. Redeploy.
3. Keep Postmark configured so pending users can still verify.
4. Run `pnpm auth:email-verification-report` and compare aggregate counts.

No session invalidation is required because access enforcement is evaluated per request against current config and `auth_users.email_verified`.
