# Launch Day Card

## Pre-Flight

1. `git switch main && git pull --ff-only origin main`
2. `pnpm install --frozen-lockfile`
3. `pnpm env:check`
4. `pnpm launch:readiness`
5. `pnpm launch:rehearsal`
6. `pnpm gate:release`

## Deploy

7. Deploy production through the configured Vercel production path.
8. Wait for the deploy to complete.

## Verify

9. `GET https://<production-url>/api/health` returns `ok: true`.
10. Login with the primary admin email.
11. `GET /api/admin/ping` returns 200 with role `admin`.
12. Admin -> Service Areas shows at least one active launch area.
13. Admin -> Nurses shows at least one verified and available nurse.

## Rehearse

14. Submit a patient request inside the active service area and confirm
    assignment.
15. Complete the nurse flow: accept, enroute, complete.
16. Confirm admin timeline, payment trace, and payout trace are visible.
17. Submit a referral partner request and confirm partner visibility.
18. Exercise an exception flow: needs review, decline or unfulfilled, then
    reopen if appropriate.

## Go/No-Go

19. If all steps are green, proceed with controlled launch.
20. If any step fails, record the failure and do not launch.

## Post-Deploy First-Hour Monitoring

21. Poll `GET https://<production-url>/api/health` every 5 minutes for the
    first hour. If it does not return `ok: true`, pause intake immediately.
22. As an authenticated admin, poll `GET /api/admin/ops/status` every 5
    minutes and record service area, nurse supply, request, exception, and
    payment counts.
23. Refresh Admin -> Active Queue, Admin -> Exception Queue, and Admin ->
    Service Areas every 5 minutes during the first hour.
24. Watch the first real request from intake through assignment, nurse accept,
    enroute, completion, payment trace, and payout trace.
25. Escalate immediately if active service areas equals 0, verified and
    available nurse supply equals 0, unassigned requests reach 3 or more for
    more than 5 minutes, any enroute request becomes stale, exception queue
    reaches 5 or more, or any payment authorization or payout failure appears.
