# Launch Day Card

## Pre-Flight

1. `git switch main && git pull --ff-only origin main`
2. `pnpm install --frozen-lockfile`
3. `pnpm env:check`
4. `pnpm launch:readiness`
5. `pnpm gate:release`

## Deploy

6. Deploy production through the configured Vercel production path.
7. Wait for the deploy to complete.

## Verify

8. `GET https://<production-url>/api/health/db` returns `{ ok: true }`.
9. Login with the primary admin email.
10. `GET /api/admin/ping` returns 200 with role `admin`.
11. Admin -> Service Areas shows at least one active launch area.
12. Admin -> Nurses shows at least one verified and available nurse.

## Rehearse

13. Submit a patient request inside the active service area and confirm
    assignment.
14. Complete the nurse flow: accept, enroute, complete.
15. Confirm admin timeline, payment trace, and payout trace are visible.
16. Submit a referral partner request and confirm partner visibility.
17. Exercise an exception flow: needs review, decline or unfulfilled, then
    reopen if appropriate.

## Go/No-Go

18. If all steps are green, proceed with controlled launch.
19. If any step fails, record the failure and do not launch.
