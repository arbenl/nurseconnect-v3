# Launch Day Card

## Pre-Flight

1. `git switch main && git pull --ff-only origin main`
2. `pnpm install --frozen-lockfile`
3. `pnpm env:check`
4. `pnpm launch:readiness`
5. `pnpm launch:rehearsal`
6. `pnpm launch:monitor -- --url https://<production-url> --once`
7. `pnpm gate:release`

## Deploy

8. Deploy production through the configured Vercel production path.
9. Wait for the deploy to complete.

## Verify

10. `GET https://<production-url>/api/health` returns `ok: true`.
11. Login with the primary admin email.
12. `GET /api/admin/ping` returns 200 with role `admin`.
13. Admin -> Service Areas shows at least one active launch area.
14. Admin -> Nurses shows at least one verified and available nurse.

## Rehearse

15. Submit a patient request inside the active service area and confirm
    assignment.
16. Complete the nurse flow: accept, enroute, complete.
17. Confirm admin timeline, payment trace, and payout trace are visible.
18. Submit a referral partner request and confirm partner visibility.
19. Exercise an exception flow: needs review, decline or unfulfilled, then
    reopen if appropriate.

## Go/No-Go

20. If all steps are green, proceed with controlled launch.
21. If any step fails, record the failure and do not launch.

## Post-Deploy First-Hour Monitoring

22. Run:

    ```bash
    pnpm launch:monitor -- --url https://<production-url>
    ```

    This polls `GET /api/health` every 5 minutes for the first hour. If it
    fails, pause intake immediately.
23. To include authenticated admin ops status, export a short-lived admin
    session cookie before running the monitor:

    ```bash
    LAUNCH_MONITOR_ADMIN_COOKIE='<cookie header>' \
      pnpm launch:monitor -- --url https://<production-url>
    ```

24. Refresh Admin -> Active Queue, Admin -> Exception Queue, and Admin ->
    Service Areas every 5 minutes during the first hour.
25. Watch the first real request from intake through assignment, nurse accept,
    enroute, completion, payment trace, and payout trace.
26. Escalate immediately if active service areas equals 0, verified and
    available nurse supply equals 0, unassigned requests reach 3 or more for
    more than 5 minutes, any enroute request becomes stale, exception queue
    reaches 5 or more, or any payment authorization or payout failure appears.
