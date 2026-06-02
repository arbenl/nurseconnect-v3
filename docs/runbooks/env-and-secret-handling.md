# Env And Secret Handling

NC-E0-03 makes `pnpm env:check` the operator contract for runtime environment validation.

## Production Runtime

Production-like validation is activated by `NODE_ENV=production`. In that mode:

- `DATABASE_URL` must be a Postgres URL.
- `BETTER_AUTH_SECRET` must be at least 32 characters.
- `BETTER_AUTH_SECRET` must not be a local placeholder value.
- `APP_URL` or `BETTER_AUTH_URL` must be a production-safe HTTPS origin.
- Email verification must run in `observe` or `enforce` mode with Postmark.

The production secret check has no bypass flag. Validation errors name the failing variable, but must not print the evaluated secret value.

## Local And CI Profiles

Unset `NODE_ENV` defaults to development for the standalone check. `NODE_ENV=test` is the CI profile and does not activate production-only secret-strength checks.

Tests may set `NC_ENV_CHECK_SKIP_LOCAL_FILES=1` to prevent `.env`, `.env.local`, and app-local env files from being loaded. Operators should not use that flag in deployed environments.

## Pre-Build Secret Scanning

The CI quality job owns the fail-closed secret scan. `Secret Scan (Gitleaks)` runs in `.github/workflows/ci.yml` before dependency install, env validation, type check, lint, and build. The step must not use `continue-on-error`.

Downstream PR gates, including Sonar, depend on the quality job instead of repeating Gitleaks in every job.

## Sonar, Sentinel, And Sentry

Sonar is a PR quality gate and coverage signal. Sentinel is used for multi-agent hardening evidence. Sentry is runtime observability and incident investigation. These tools do not replace the pre-build Gitleaks secret scan.

Keep their tokens in GitHub or platform secrets only. Do not commit tokens, DSNs with private material, local `.env` files, or production connection strings.

## Documentation Boundary

This runbook intentionally contains variable names and dummy formats only. It must not include real credentials, tokens, PHI, tenant data, or production URLs with secret material.
