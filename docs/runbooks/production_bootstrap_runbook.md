## Production Bootstrap Runbook (V3)

### 0. Preconditions

* Database is provisioned and reachable from Vercel.
* **Migrations have been applied** using the direct database URL.
* The Vercel project is linked to this repository.
* Application is deployed and reachable at the intended production URL.

### 1) Environment Preparation

#### Required

* `DATABASE_URL` — Postgres connection string.
* `BETTER_AUTH_SECRET` — strong secret (rotating invalidates existing sessions).

#### Required for production correctness (Better‑Auth origin safety)

* `APP_URL` — the canonical production origin, e.g. `https://nurseconnect.example.com`
  Better‑Auth uses this as `baseURL` and `trustedOrigins`.
* `BETTER_AUTH_URL` — optional if `APP_URL` is set; used as fallback if `APP_URL` is missing. Recommended to set it to the same value as `APP_URL`.
* `VERCEL_URL` — injected automatically by Vercel for preview deployments. Do not set it manually.

#### Bootstrap configuration

* `FIRST_ADMIN_EMAILS` — optional comma-separated allowlist of emails that may be auto-promoted to admin on first login via `/api/me`.

  * Example: `ceo@nurseconnect.com,ops@nurseconnect.com`
  * **Case-insensitive**; whitespace is trimmed.
  * Leaving empty is safe-by-default: **no one is auto-promoted**.

#### Optional production alerting

* `OPS_ALERT_WEBHOOK_URL` — optional webhook endpoint for high-signal
  production operations alerts.

  * Leaving empty is supported; the app will rely on structured logs and
    OTel/log drains only.
  * When set, it should receive non-PHI alerts for failed payment
    authorizations and failed payouts.

#### Optional launch monitor configuration

* `LAUNCH_MONITOR_URL` — optional base URL used by `pnpm launch:monitor` when
  `--url` is omitted. In production use the canonical app origin.
* `LAUNCH_MONITOR_ADMIN_COOKIE` — optional short-lived admin `Cookie` header
  used by `pnpm launch:monitor` to poll `GET /api/admin/ops/status`.

  * Leave empty when only public `/api/health` monitoring is needed.
  * Do not commit this value. Use a terminal-local export for launch day.

#### Optional auth/session synthetic monitor configuration

* `LAUNCH_AUTH_MONITOR_URL` — optional base URL used by
  `pnpm launch:auth-monitor` when `--url` is omitted.
* `LAUNCH_AUTH_MONITOR_EMAIL` — dedicated synthetic admin email for
  auth/session monitoring.
* `LAUNCH_AUTH_MONITOR_PASSWORD` — password for the synthetic admin.

  * The synthetic user must be an admin before launch monitoring begins.
  * Do not reuse a human operator credential.
  * Do not commit, paste, or log the password, session cookie, or Better Auth
    session token.

#### DB connection strategy (Connection Pooling)

* `DATABASE_URL` — should be the **direct** (unpooled) database URL. This is critical for Drizzle migrations (`pnpm db:migrate`) to succeed without hanging.
* `DATABASE_POOL_URL` — optional URL representing a pooled connection (e.g. PgBouncer, Neon pooled endpoint). Used by the application at runtime to avoid stranding/starving connections.
* `PGPOOL_IDLE_TIMEOUT_MS` — recommended to be kept aggressively low (e.g. `5000` ms) in Serverless / Edge functions (like Vercel) instead of relying on default timeouts.
* `PGPOOL_MAX` — max connections the pool can open. **Caution**: Vercel recommends against `max=1` in Fluid Compute environments; size appropriately based on your downstream limits.

#### Vercel environment setup

For local validation against Vercel-managed environment variables:

```bash
vercel link
vercel env pull .env.local
```

For production, configure the required variables in the Vercel project settings, scoped to Production. Configure preview-specific values in Preview when they differ from production.

---

### 2) Smoke verification: app + DB are up

From your browser or curl:

* `GET /api/health` should return `ok: true`, `db: "ok"`, at least one active
  service area, and verified/available nurse supply above 0 before launch
  intake opens.
* `GET /api/health/db` should return `{ ok: true, db: "ok" }` for legacy
  monitor compatibility.

For the first-hour synthetic monitor:

```bash
pnpm launch:monitor -- --url https://<production-url> --once
pnpm launch:monitor -- --url https://<production-url>
LAUNCH_AUTH_MONITOR_EMAIL='<synthetic admin email>' \
LAUNCH_AUTH_MONITOR_PASSWORD='<synthetic admin password>' \
  pnpm launch:auth-monitor -- --url https://<production-url>
```

To include authenticated admin ops status:

```bash
LAUNCH_MONITOR_ADMIN_COOKIE='<cookie header>' \
  pnpm launch:monitor -- --url https://<production-url>
```

---

### 3) Bootstrapping the Primary Admin

1. Visit the public home page:
   * `GET /` should load publicly.

2. Go to login:
   * `GET /login` should load.

3. Sign up / sign in using an email included in `FIRST_ADMIN_EMAILS`.

4. Trigger the promotion path (authoritative)
   * Ensure the client calls **`GET /api/me`** (it’s the session + domain user sync endpoint).
     This endpoint upserts the domain user and then attempts allowlist-based admin bootstrap.

**Promotion validation options:**
* Open `/api/me` in the browser and confirm JSON contains `user.role: "admin"`.
* Or call the admin RBAC sentinel:
  * `GET /api/admin/ping` should return `200` with `{ ok: true, user: { role: "admin" } }`.
* Then call the admin operations status endpoint:
  * `GET /api/admin/ops/status` should return operational counts for service
    areas, nurse supply, active requests, exception queue, and payment/payout
    status.
  * `pnpm launch:auth-monitor -- --url https://<production-url>` should
    sign in the synthetic admin, confirm `/api/me`, confirm `/api/admin/ping`,
    and sign out without printing secrets.

---

### 4) Post-deployment middleware validation (defense-in-depth)

In a private/incognito window:

1. Navigate to `/dashboard`
   * Expect an immediate redirect to `/login` (commonly 307/302).

2. Navigate to `/admin`
   * Expect an immediate redirect to `/login` (commonly 307/302).

Notes:
* Middleware is **optimistic** (cookie presence only). Strict session enforcement still happens in server layouts/routes via `getSession()`.

---

### 5) Operational handover notes

* Better‑Auth session is verified server-side via `auth.api.getSession({ headers })`; authorization checks compare against the **domain DB user role**.
* Users not allowlisted in `FIRST_ADMIN_EMAILS` remain `patient` by default; the admin bootstrap has **no** “first user becomes admin” fallback.

---

### Appendix: Failure Modes

* **Invalid Origin**: If auth redirects repeatedly fail or CSRF errors appear, verify `APP_URL` matches the deployed production hostname. For previews, verify Vercel injected `VERCEL_URL`.
* **No Admin Created**: If you login but do not gain admin access, verify `FIRST_ADMIN_EMAILS` is not empty, contains the exact email address, and that `/api/me` is successfully executing without network blockers.
* **DB Not Migrated**: If `/api/health/db` or login actions throw 500s mentioning missing relations, confirm `pnpm db:migrate` ran successfully with the production direct database URL.
* **Auth Monitor Failing**: If `pnpm launch:auth-monitor` fails at sign-in,
  verify the synthetic admin email/password and `APP_URL`/`BETTER_AUTH_URL`.
  If sign-in passes but `/api/me` or `/api/admin/ping` fails, verify the domain
  user role is `admin` and session cookies are being accepted by the production
  origin.
