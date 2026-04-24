# M14: Rehearsal Browser Hardening Design

## Purpose

Harden the launch rehearsal tooling based on the live watched Chrome run.

The product flows passed, but the run exposed two launch-tooling issues:

- `pnpm launch:seed` failed locally because Better Auth sign-up rejected requests
  without an `Origin` header.
- Vercel Analytics and Speed Insights client scripts generated repeated CSP
  noise in local/dev browser rehearsal.

This slice fixes those issues without changing production business behavior.

## Scope

- Send the app origin when the rehearsal seed script calls Better Auth sign-up
  and session bootstrap endpoints.
- Keep the seed script importable for focused unit tests by guarding `main()`.
- Render Vercel client telemetry only in production so local watched rehearsals
  are not polluted by expected CSP blocks.
- Add a first-class headed browser rehearsal command for slow operator
  observation.
- Extend Playwright config with an opt-in slow-motion launch setting.
- Update launch readiness docs and verifier coverage for the headed rehearsal.

## Non-Scope

- Product UI redesign.
- New launch features.
- Relaxing CSP to allow third-party analytics in development.
- Replacing the existing M7 browser rehearsal.

## Validation

- `pnpm test:scripts`
- `pnpm --filter web type-check`
- `pnpm launch:readiness`
- `pnpm launch:seed` against the test database with the local app running
- `PLAYWRIGHT_SLOW_MO_MS=1 pnpm --filter web test:e2e:m7-browser -- --headed`
