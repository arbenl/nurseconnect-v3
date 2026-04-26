# Launch Day Card

## Pre-Flight

1. `git switch main && git pull --ff-only origin main`
2. `pnpm install --frozen-lockfile`
3. `pnpm env:check`
4. `pnpm launch:readiness`
5. `pnpm launch:rehearsal`
6. Run the one-shot launch monitor with authenticated ops status:

   ```bash
   LAUNCH_MONITOR_ADMIN_COOKIE='<cookie header>' \
     pnpm launch:monitor -- --url https://<production-url> --once --require-admin-ops
   ```

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
16. Admin -> Dashboard shows nurse supply `ready` with at least 10 verified,
    available, dispatch-eligible nurses in every active launch area.

## Rehearse

17. Submit a patient request inside the active service area and confirm
    assignment.
18. Complete the nurse flow: accept, enroute, complete.
19. Confirm admin timeline, payment trace, and payout trace are visible.
20. Submit a referral partner request and confirm partner visibility.
21. Exercise an exception flow: needs review, decline or unfulfilled, then
    reopen if appropriate.

## Go/No-Go

22. Open `docs/runbooks/controlled_launch_execution_readiness.md` and copy the
    operator decision ledger template into Notion or a private launch evidence
    artifact. Do not fill production evidence into the tracked repo runbook.
23. Confirm the release PR had a green `Sonar Quality Gate` check and PR-facing
    Sonar summary. A green scheduled `Sonar Baseline` is not a substitute.
24. Record one decision:
    - **GO**: all hard gates are green, any soft gate has an accepted
      mitigation, and authenticated first-hour monitoring is ready to start.
    - **HOLD**: no hard gate is red, but intake stays closed while an owner
      completes a bounded mitigation and re-check.
    - **NO-GO**: any hard gate is red, production state cannot be verified, or
      a secret/token/PHI exposure occurred.
25. Proceed with controlled launch only on GO, and start the authenticated
    first-hour monitor before opening intake.
26. On HOLD or NO-GO, record the failed gate and do not open intake.

## Post-Deploy First-Hour Monitoring

27. Run the authenticated first-hour monitor:

    ```bash
    LAUNCH_MONITOR_ADMIN_COOKIE='<cookie header>' \
      pnpm launch:monitor -- --url https://<production-url> --require-admin-ops
    ```

    This polls `GET /api/health` and authenticated `GET /api/admin/ops/status`
    every 5 minutes for the first hour. If it fails, pause intake immediately.
    Public health-only monitoring is not sufficient for GO.

28. In a second terminal, run the auth/session monitor every 10 minutes:

    ```bash
    LAUNCH_AUTH_MONITOR_EMAIL='<synthetic admin email>' \
    LAUNCH_AUTH_MONITOR_PASSWORD='<synthetic admin password>' \
      pnpm launch:auth-monitor -- --url https://<production-url>
    ```

    Never paste the password or cookie into notes, PRs, logs, or Notion.
29. Refresh Admin -> Dashboard every 5 minutes during the first hour and review
    the Launch operator signals section. Drill into Active Queue, Exception
    Queue, Service Areas, and the Payment follow-up request links when any
    badge turns non-zero or blocked.
30. Watch the first real request from intake through assignment, nurse accept,
    enroute, completion, payment trace, and payout trace.
31. Escalate immediately if active service areas equals 0,
    `nurseSupply.launchReady` is false, unassigned requests reach 3 or more
    for more than 5 minutes, any enroute request becomes stale, exception queue
    reaches 5 or more, any payment authorization or payout failure appears, or
    the auth/session monitor cannot sign in, bootstrap `/api/me`, or reach
    `/api/admin/ping`.
