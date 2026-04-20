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

## Repo Isolation

If Codex or MCP evidence appears under an Interdomestik path while working on NurseConnect:

1. Stop the active tool/session.
2. Restart from `/Users/arbenlila/development/nurseconnect-v3`.
3. Confirm `.codex/config.toml` is the loaded repo config.
4. Confirm Playwright MCP uses `/Users/arbenlila/development/nurseconnect-v3/.codex/playwright-profile`.
5. Confirm evidence writes to `/tmp/nurseconnect-evidence`.
6. Confirm QA MCP calls use `nurseconnect_qa`, not `interdomestik_qa`.

If `interdomestik_qa` appears as enabled or returns `Auth unsupported` while working in NurseConnect, treat it as the wrong repository tool leaking into the session. Restart Codex from this repo and use the repo-owned `nurseconnect_qa` server from `.codex/config.toml`.
