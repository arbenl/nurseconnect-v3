# Troubleshooting

## Environment & Dependency Issues

### Vercel env vars are missing locally

Run:

```bash
vercel link
vercel env pull .env.local
```

Then verify required keys:

```bash
pnpm env:check
```

Production custom domains must set `APP_URL` and `BETTER_AUTH_URL` explicitly. Preview deployments can use Vercel's injected `VERCEL_URL`.

### `pnpm install` / `EPERM` Errors
If you encounter persistent `EPERM` or file lock errors during `pnpm install` or scripts, it is likely due to file ownership issues or locked processes.

**Remediation Recipe:**

```bash
# 1. Close VS Code, Dev Servers, and relevant terminal processes
# 2. Reset Ownership & Clear State
sudo lsof +D node_modules 2>/dev/null | head -n 30 # Check for locks
sudo chown -R "$USER":staff .
rm -rf node_modules .pnpm-store
pnpm store prune || true
pnpm install

# 3. If EPERM persists (macOS flags):
sudo chflags -R nouchg,noschg .
rm -rf node_modules .pnpm-store
pnpm install
```
