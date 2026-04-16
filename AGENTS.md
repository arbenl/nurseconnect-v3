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

## MCP Guidance For NurseConnect

- `playwright` is the preferred browser-validation tool for this repo.
- `context7` is the preferred current-docs tool for framework behavior that could have changed.
- Notion MCP is allowed when the task explicitly includes Notion sync or documentation updates.
- Do not assume tools like `interdomestik_qa` or other repo-specific QA servers apply to NurseConnect unless they are added to NurseConnect's local config.

## Editing Constraints

- Keep repo-scoped tooling changes local to this repository.
- Prefer adding or updating files under this repository rather than changing user-global Codex configuration.
- If a new NurseConnect-specific MCP server is needed later, add it to this repo's `.codex/config.toml` instead of repointing another repo's server.
