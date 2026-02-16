# Troubleshooting

## Environment & Dependency Issues

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
