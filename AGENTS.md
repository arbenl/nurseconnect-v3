# NurseConnect AGENTS.md

This file defines repo-scoped guidance for agentic coding agents working on `nurseconnect-v3`.

## Scope

These instructions apply to this repository only.

Do not assume MCP tooling or repo policies from other repositories apply here unless they are explicitly configured in this repo.

## MCP-First Tooling

- Prefer repo-scoped MCP tools over shell-only fallbacks when equivalent capability exists in this repo.
- Use Playwright MCP first for browser validation, UI smoke checks, and watched flows.
- Use `context7` for current framework guidance when Next.js, React, Playwright, or other framework behavior may have changed.
- Use Notion MCP when the user explicitly asks to sync, create, or update Notion pages.
- If an MCP tool is blocked or unavailable, report the exact blocker and exact error before falling back to shell-only alternatives.

## Repo-Scoped MCP Source Of Truth

- The repo-local MCP wiring for this codebase lives in `.codex/config.toml`.
- Do not modify `~/.codex/config.toml` to make NurseConnect tooling work.
- Do not reuse repo-specific MCP servers from other repositories unless NurseConnect is explicitly wired to them.
- Configure any Codex repo trust decision in your own local Codex setup; do not commit per-user `[project."..."]` trust blocks into this repository.

## MCP Guidance For NurseConnect

- `playwright` is the preferred browser-validation tool for this repo.
- `context7` is the preferred current-docs tool for framework behavior that could have changed.
- Notion MCP is allowed when the task explicitly includes Notion sync or documentation updates.
- Do not assume tools like `interdomestik_qa` or other repo-specific QA servers apply to NurseConnect unless they are added to NurseConnect's local config.
- Before activating optional plugins, apply `docs/runbooks/plugin_activation_policy.md` and record blockers for unavailable plugin routes.

## Editing Constraints

- Keep repo-scoped tooling changes local to this repository.
- Prefer adding or updating files under this repository rather than changing user-global Codex configuration.
- If a new NurseConnect-specific MCP server is needed later, add it to this repo's `.codex/config.toml` instead of repointing another repo's server.

## Slice Workflow

Use the NurseConnect slice workflow for product, platform, ops, and launch work:

1. Start from clean, synced `main`.
2. Define the slice and create a fresh `codex/<slice-name>` branch.
3. Implement only that slice.
4. Run focused deterministic local checks while developing.
5. Run `pnpm verify-slice` and keep the printed `run_root`.
6. Run `pnpm verify-slice -- --run-root <run_root> --static`.
7. Run the pre-PR reviewer pool from the generated `tmp/multi-agent/verify-slice/<run-id>/reviewer-plan.md`.
8. Fix all `MUST_FIX` findings, or document a technical rejection before PR.
9. Run `pnpm verify-slice -- --run-root <run_root> --required-gates`.
10. Open a PR with verify-slice evidence paths.
11. Fix CI, Sonar if present, Copilot, and other PR review findings.
12. Merge only after all required checks pass, including PR Finalizer.
13. Sync local `main`, update Notion when the slice changes program state, and delete the local and remote branch.

For tiny docs-only slices, a lightweight reviewer pool is acceptable only when the PR body explicitly explains the reduced review scope. Do not silently skip `verify-slice`. Docs-only `verify-slice --required-gates` and the pre-push guard use the docs/static hygiene path instead of the full `pnpm gate:release`; CI and PR Finalizer remain authoritative after the PR opens.

## Modularity Guard

- Keep every new checked source, script, workflow, config, and test file at or below 150 lines.
- If a touched legacy file already exceeds 150 lines, do not make it larger; split the touched logical path into focused helpers.
- `pnpm modularity:guard` is mandatory evidence for slice readiness and PR evidence.

<!-- FAST-TOOLS PROMPT v1 | codex-mastery | watermark:do-not-alter -->

## CRITICAL: Use ripgrep, not grep

NEVER use grep for project-wide searches (slow, ignores .gitignore). ALWAYS use rg.

- `rg "pattern"` — search content
- `rg --files | rg "name"` — find files
- `rg -t python "def"` — language filters

## File finding

- Prefer `fd` (or `fdfind` on Debian/Ubuntu). Respects .gitignore.

## JSON

- Use `jq` for parsing and transformations.

## Install Guidance

- macOS: `brew install ripgrep fd jq`
- Debian/Ubuntu: `sudo apt update && sudo apt install -y ripgrep fd-find jq` (alias `fd=fdfind`)

## Agent Instructions

- Replace commands: grep→rg, find→rg --files/fd, ls -R→rg --files, cat|grep→rg pattern file
- Cap reads at 250 lines; prefer `rg -n -A 3 -B 3` for context
- Use `jq` for JSON instead of regex

<!-- END FAST-TOOLS PROMPT v1 | codex-mastery -->
