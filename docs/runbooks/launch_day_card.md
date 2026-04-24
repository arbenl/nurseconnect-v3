# Launch Day Card

## Pre-Flight

1. `git switch main && git pull --ff-only origin main`
2. `pnpm install --frozen-lockfile`
3. `pnpm env:check`
4. `pnpm launch:readiness`
5. `pnpm launch:rehearsal`
6. `pnpm launch:monitor -- --url https://<production-url> --once`
7. Run the synthetic auth monitor with the dedicated synthetic admin:

   ```bash
   LAUNCH_AUTH_MONITOR_EMAIL='<synthetic admin email>' \
   LAUNCH_AUTH_MONITOR_PASSWORD='<synthetic admin password>' \
     pnpm launch:auth-monitor -- --url https://<production-url>
   ```

8. `pnpm gate:release`

## Deploy

9. Deploy production through the configured Vercel production path.
10. Wait for the deploy to complete.

## Verify

11. `GET https://<production-url>/api/health` returns `ok: true`.
12. Login with the primary admin email.
13. `GET /api/admin/ping` returns 200 with role `admin`.
14. The synthetic auth monitor command from pre-flight returns green.
15. Admin -> Service Areas shows at least one active launch area.
16. Admin -> Nurses shows at least one verified and available nurse.

## Rehearse

17. Submit a patient request inside the active service area and confirm
    assignment.
18. Complete the nurse flow: accept, enroute, complete.
19. Confirm admin timeline, payment trace, and payout trace are visible.
20. Submit a referral partner request and confirm partner visibility.
21. Exercise an exception flow: needs review, decline or unfulfilled, then
    reopen if appropriate.

## Go/No-Go

22. If all steps are green, proceed with controlled launch.
23. If any step fails, record the failure and do not launch.

## Post-Deploy First-Hour Monitoring

24. Run:

    ```bash
    pnpm launch:monitor -- --url https://<production-url>
    ```

    This polls `GET /api/health` every 5 minutes for the first hour. If it
    fails, pause intake immediately.
25. To include authenticated admin ops status, export a short-lived admin
    session cookie before running the monitor:

    ```bash
    LAUNCH_MONITOR_ADMIN_COOKIE='<cookie header>' \
      pnpm launch:monitor -- --url https://<production-url>
    ```

26. In a second terminal, run the auth/session monitor every 10 minutes:

    ```bash
    LAUNCH_AUTH_MONITOR_EMAIL='<synthetic admin email>' \
    LAUNCH_AUTH_MONITOR_PASSWORD='<synthetic admin password>' \
      pnpm launch:auth-monitor -- --url https://<production-url>
    ```

    Never paste the password or cookie into notes, PRs, logs, or Notion.
27. Refresh Admin -> Active Queue, Admin -> Exception Queue, and Admin ->
    Service Areas every 5 minutes during the first hour.
28. Watch the first real request from intake through assignment, nurse accept,
    enroute, completion, payment trace, and payout trace.
29. Escalate immediately if active service areas equals 0, verified and
    available nurse supply equals 0, unassigned requests reach 3 or more for
    more than 5 minutes, any enroute request becomes stale, exception queue
    reaches 5 or more, any payment authorization or payout failure appears, or
    the auth/session monitor cannot sign in, bootstrap `/api/me`, or reach
    `/api/admin/ping`.
