# NurseConnect Enterprise Constitution (AGENTS.md)

Binding, repo-scoped doctrine for every agentic coding agent (Codex, Claude,
Gemini, Copilot) working on `nurseconnect-v3`. These instructions apply to this
repository only; do not import policies from other repositories.

## Authority Chain (read in this order, lower defers to higher)

1. `docs/plans/current-program.md` — singular source of truth
2. `docs/plans/current-tracker.md` — active slice queue
3. `docs/plans/ENTERPRISE_UPGRADE_TRACKER.md` — Phase C execution map
4. This file — execution constitution
5. Skill SOP: `nurseconnect-execution-runner` (in `.codex/`, `.claude/`, `.gemini/` skills)
6. `docs/runbooks/slice_playbook_scorecard.md` and `code_review.md` — slice discipline and review defaults

The repo is mid **Phase C Enterprise Upgrade**. `HANDOVER.md` and
`project_architecture.md` describe current reality; pre-2026-06 roadmaps are void.

## The Four Mandates (non-negotiable)

1. **No bare-row mutations.** All domain state changes must co-commit their
   evidence in the same transaction: today that means an appended
   `service_request_events` / audit row; once `NC-E3-02 (platform-events)`
   merges, **all state changes must append to the Transactional Outbox** and
   all side effects move to outbox consumers. Effective immediately: adding any
   NEW inline side effect inside a `db.transaction` is a constitutional
   violation, even before the outbox exists.
2. **No cross-domain SQL joins. Read models only.** Domain packages may not
   join or import another domain's tables. The three legacy violations
   (`domain-referral`, `domain-visit`, `domain-nurse`) are quarantined debt
   owned by band NC-CQ — do not extend them, do not copy the pattern. New
   cross-domain reads go through owned read models or published contracts.
3. **No raw string states.** Core state mutations require phantom-typed proof
   tokens: `AuthorizedTransition` for `service_requests.status` (NC-E2-03),
   `MedicalEvidence` / `VerifiedCredentialEvidence` for `nurses.status` and
   clinical writes (NC-E2-04), branded `OrganizationId` for tenant context
   (live now). Effective immediately: never add a new write site that sets a
   status/state column from a raw string outside its owning domain's
   transition functions.
4. **No PR without gates.** A PR may not be opened unless
   `pnpm verify-slice -- --run-root <run_root> --required-gates` passed,
   including the ent-gate stage once NC-EG-01 merges (`ent-tm` threat-model and
   `ent-dlv` data-lifecycle/erasure assertions are mandatory; `n/a` requires
   written justification in `slice-gates.yaml`). Never relax, skip, or
   reinterpret a gate to make a slice pass — fix the slice or amend the gate in
   its own reviewed slice.

Standing invariants (from `current-program.md`): notifications are post-commit
and non-PHI; never log or message PHI; tenant isolation targets shared-schema
RLS; Interdomestik is a reference to copy-and-own, never a dependency; slice
acceptance must be falsifiable.

## Slice Workflow

Execute slices only via the `nurseconnect-execution-runner` SOP. Summary:

1. Start from clean, synced `main`; confirm the promoted slice in the trackers.
   Record active slice, risk tier, branch readiness, protected-scope status, and non-goals.
2. Draft slice design; request configured external review; apply accepted findings.
3. Create one fresh `codex/<slice-name>` branch; implement only that slice.
4. Run focused deterministic checks while developing.
5. `pnpm verify-slice` — keep the printed `run_root`.
6. `pnpm verify-slice -- --run-root <run_root> --static`.
7. Run the reviewer pool from `tmp/multi-agent/verify-slice/<run-id>/reviewer-plan.md`.
8. Fix every `MUST_FIX` or document a technical rejection before PR.
9. `pnpm verify-slice -- --run-root <run_root> --required-gates`.
10. Open one PR with verify-slice evidence paths; fix CI, Sonar, review-bot, and reviewer findings.
11. Merge only after all required checks pass, including PR Finalizer.
12. Sync `main`, record closeout in the trackers, delete branches, promote next slice.

Docs-only slices may use the docs/static hygiene path, never a silent skip of
`verify-slice`; the PR body must state the reduced scope. CI and PR Finalizer
remain authoritative after the PR opens.

Use `docs/runbooks/slice_playbook_scorecard.md` to avoid duplicate gates and to
record reviewer blockers, CI reruns, and closeout evidence.

## Modularity Guard

- Every new checked source/script/workflow/config/test file ≤ 150 lines.
- Never grow a >150-line legacy file; split the touched path into helpers.
- `pnpm modularity:guard` and `pnpm architecture:boundaries` are mandatory PR evidence.

## MCP-First Tooling

- Repo-local MCP wiring lives in `.codex/config.toml`; never modify user-global
  config or reuse other repos' servers (no `interdomestik_qa`; use `nurseconnect_qa`).
- Playwright MCP first for browser validation; `context7` for current framework
  docs; Notion MCP only when explicitly asked to sync Notion.
- If an MCP tool is blocked, report the exact blocker/error before shell fallback.
- Before activating optional plugins, apply `docs/runbooks/plugin_activation_policy.md`.

## Obsidian Wiki Context Protocol

For substantive NurseConnect work, use the local Obsidian LLM Wiki as the orientation layer before broad source scanning:

1. Read `/Users/arbenlila/Documents/Knowledge Manager and Systems Architect/Wiki/Home.md`.
2. Read `/Users/arbenlila/Documents/Knowledge Manager and Systems Architect/Wiki/projects/nurseconnect.md`.
3. Read relevant generated module/concept pages, especially under:
   - `Wiki/modules/nurseconnect/`
   - `Wiki/cross-project-concepts/`
   - `Wiki/architecture/`
   - `Wiki/api-references/`
4. Read relevant human notes under `/Users/arbenlila/Documents/Knowledge Manager and Systems Architect/Notes/`.
5. Then inspect exact source files in this repository.

The wiki is a memory and navigation layer only. It never overrides this `AGENTS.md`, NurseConnect trackers, source code, tests, gates, user instructions, PHI/compliance boundaries, or repo-specific MCP evidence.

If the task produces durable architecture rationale, add or update a note under the vault's `Notes/` tree rather than editing generated wiki pages.

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
