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
5. Run `pnpm verify-slice -- --static`.
6. Run the pre-PR reviewer pool from the generated `tmp/multi-agent/verify-slice/<run-id>/reviewer-plan.md`.
7. Fix all `MUST_FIX` findings, or document a technical rejection before PR.
8. Run `pnpm verify-slice -- --required-gates`.
9. Open a PR with verify-slice evidence paths.
10. Fix CI, Sonar if present, Copilot, and other PR review findings.
11. Merge only after all required checks pass, including PR Finalizer.
12. Sync local `main`, update Notion when the slice changes program state, and delete the local and remote branch.

For tiny docs-only slices, a lightweight reviewer pool is acceptable only when the PR body explicitly explains the reduced review scope. Do not silently skip `verify-slice`.
