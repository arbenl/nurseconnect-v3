## Production Bootstrap Runbook (V3)

### 0. Preconditions

* Database is provisioned and reachable.
* **Migrations have been applied** (recommended: run `pnpm db:migrate` as part of deploy).
* Application is deployed and reachable at the intended production URL.

### 1) Environment Preparation

#### Required

* `DATABASE_URL` — Postgres connection string.
* `BETTER_AUTH_SECRET` — strong secret (rotating invalidates existing sessions).

#### Required for production correctness (Better‑Auth origin safety)

* `APP_URL` — the canonical production origin, e.g. `https://nurseconnect.example.com`
  Better‑Auth uses this as `baseURL` and `trustedOrigins`.
* `BETTER_AUTH_URL` — optional if `APP_URL` is set; used as fallback if `APP_URL` is missing. Recommended to set it to the same value as `APP_URL`.

#### Bootstrap configuration

* `FIRST_ADMIN_EMAILS` — optional comma-separated allowlist of emails that may be auto-promoted to admin on first login via `/api/me`.

  * Example: `ceo@nurseconnect.com,ops@nurseconnect.com`
  * **Case-insensitive**; whitespace is trimmed.
  * Leaving empty is safe-by-default: **no one is auto-promoted**.

#### DB connection strategy (Connection Pooling)

* `DATABASE_URL` — should be the **direct** (unpooled) database URL. This is critical for Drizzle migrations (`pnpm db:migrate`) to succeed without hanging.
* `DATABASE_POOL_URL` — optional URL representing a pooled connection (e.g. PgBouncer, Neon pooled endpoint). Used by the application at runtime to avoid stranding/starving connections.
* `PGPOOL_IDLE_TIMEOUT_MS` — recommended to be kept aggressively low (e.g. `5000` ms) in Serverless / Edge functions (like Vercel) instead of relying on default timeouts.
* `PGPOOL_MAX` — max connections the pool can open. **Caution**: Vercel recommends against `max=1` in Fluid Compute environments; size appropriately based on your downstream limits.

---

### 2) Smoke verification: app + DB are up

From your browser or curl:

* `GET /api/health/db` should return `{ ok: true, db: "ok" }`.

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

* **Invalid Origin**: If auth redirects repeatedly fail or CSRF errors appear, verify `APP_URL` matches the deployed hostname perfectly. Better-Auth rigorously enforces `trustedOrigins`.
* **No Admin Created**: If you login but do not gain admin access, verify `FIRST_ADMIN_EMAILS` is not empty, contains the exact email address, and that `/api/me` is successfully executing without network blockers.
* **DB Not Migrated**: If `/api/health/db` or login actions throw 500s mentioning missing relations, confirm `pnpm db:migrate` ran successfully on the production container.
