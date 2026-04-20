# Important Rules

## Platform

- NurseConnect V3 is Vercel-native.
- Do not add Firebase packages, Firebase config, Firestore rules, Firebase Auth, Firebase Functions, or emulator workflows.
- Use Vercel previews for branch validation and Vercel production deployments for releases.

## Backend

- Keep domain data in PostgreSQL through Drizzle.
- Keep authentication on Better Auth unless a future approved migration replaces it.
- Use server-only code for privileged state changes.
- Do not introduce client-side secrets or public env vars that expose server credentials.

## Environment

- Use `vercel link` and `vercel env pull .env.local` for local Vercel environment bootstrap.
- Set production `APP_URL` and `BETTER_AUTH_URL` to the canonical production origin.
- Rely on `VERCEL_URL` for preview deployment origins.
- Keep secrets in Vercel environment variables or `.env.local`, never in tracked files.

## Verification

- Run type-check, lint, tests, and build before marking work complete.
- Use Playwright for browser smoke checks when UI behavior changes.
- Keep GitHub Actions as the quality gate and Vercel as the preview/deploy platform.
