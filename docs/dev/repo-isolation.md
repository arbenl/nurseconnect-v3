# Repo Isolation

NurseConnect and Interdomestik must run as separate systems. Do not share MCP servers, Playwright profiles, evidence folders, or local dev ports between the repositories.

## NurseConnect Ownership

- Repository root: `/Users/arbenlila/development/nurseconnect-v3`
- Default web dev port: `3010`
- Local app URL: `http://localhost:3010`
- Repo MCP config: `.codex/config.toml`
- Repo-owned QA MCP server: `nurseconnect_qa`
- Playwright MCP profile: `/Users/arbenlila/development/nurseconnect-v3/.codex/playwright-profile`
- Playwright MCP output: `/Users/arbenlila/development/nurseconnect-v3/.codex/playwright-output`
- Evidence root: `/tmp/nurseconnect-evidence`

## Boundaries

- Do not configure NurseConnect by editing `~/.codex/config.toml`.
- Do not use Interdomestik MCP servers such as `interdomestik_qa` from this repo.
- Use `nurseconnect_qa` for NurseConnect QA commands when a repo-scoped QA MCP server is available.
- Do not run NurseConnect on port `3000`; that port belongs to Interdomestik local development.
- Keep repository-specific paths absolute where MCP tools require persistent state.

## Failure Signal

If Playwright MCP tries to create `/.codex`, the active session is not using this repo's MCP config. Restart the Codex session from `/Users/arbenlila/development/nurseconnect-v3` and verify `.codex/config.toml` is loaded.
