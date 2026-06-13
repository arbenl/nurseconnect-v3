# ADR-005: Slice Lifecycle Automation — Event-Derived Tracker + Server-Side Gatekeeper

**Status:** Accepted
**Date:** 2026-06-10
**Related:** AGENTS.md (Four Mandates), `docs/plans/ENTERPRISE_UPGRADE_TRACKER.md`
(NC-EG band), NC-EG-01 design, `nurseconnect-execution-runner` SOP.

## Context

Tracker files (`current-tracker.md`, `ENTERPRISE_UPGRADE_TRACKER.md`) are today
mutable state stores that agents edit by hand. This reproduces, in our DevOps
layer, the exact pathology the Four Mandates forbid in the data layer: bare-row
mutation of authoritative state. Observed failure classes: agents marking
slices `completed` before merge; tracker edits drifting from git reality;
proposed automation (a Python CLI, reviewed 2026-06-10) that executed
verification commands sourced from doc frontmatter (injection surface) and
wrote `completed` pre-merge.

Two automation paths were considered, plus a synthesis:

1. **Agent-side MCP server** (`promote_slice`/`closeout_slice` tools).
2. **Server-side GitHub Actions/webhooks** deriving tracker state from events.

**Key finding:** anything executing in the agent's environment (CLI or MCP
server alike) runs with the agent's own credentials and is therefore
*advisory*, not enforcement — the agent retains `git`/`gh` and can bypass it.
The only real trust boundary is server-side: branch protection + required
checks (PR Finalizer). Conversely, pure event-driven automation cannot express
*promotion*, because "what slice is next" is a decision, not a git event.

## Decision

Split the slice lifecycle into **three planes**, applying our own CQRS/EDA
doctrine to the bureaucracy itself:

1. **Plane of record (server-side, event-derived).** Git/PR events are the
   source of truth. A GitHub Actions workflow on `pull_request` `closed` +
   `merged` parses the slice ID from the `codex/<slice>` branch, validates it
   against the promoted slice, and a bot — **the only writer of `completed`** —
   commits closeout rows (PR #, merge commit, gate summary) to both trackers
   and `current-program.md`. Tracker statuses become read models / projections
   of merge reality; `completed` cannot lie by construction.
2. **Plane of enforcement (server-side, existing spine).** PR Finalizer — a
   required check — is the gatekeeper. NC-EG-01 extends it with the ent-gate
   evidence block and manifest-sha pinning; this ADR additionally assigns it
   branch-name validation (`codex/<slice>`) and promoted-slice matching.
   "Impossible to open a PR without the assertions" is true only at this layer.
3. **Plane of decision (agent-side, authority-free).** `start <id>` remains a
   thin client — exposed as an MCP tool to satisfy the MCP-First mandate — that
   validates promotion against the tracker, creates the branch, and opens the
   promotion PR. It holds **no authority**: bypassing it loses nothing, because
   planes 1–2 reject non-compliant work at PR time. A client that is safe to
   bypass is the constitutional definition of a sound client.

### Self-tampering protection (CODEOWNERS)

The gatekeepers must not be editable by the agents they police. CODEOWNERS
entries (enforced via branch protection "require code owner review") are
required for at minimum:

```text
/.github/workflows/**
/scripts/multi-agent/**
/scripts/ent-gates/**
/scripts/lib/** (incl. pr-slice-evidence.mjs — the plane-2 validator itself)
/config/ent-gate-paths.json
/docs/plans/**
/.codex/skills/** /.claude/skills/** /.gemini/skills/**
```

GitHub's elevated `workflows` permission requirement for PRs that modify
Actions provides defense in depth, not a substitute.

## Options Considered

- **A. Agent-side CLI (rejected as authority):** reviewed implementation had
  pre-merge `completed` writes, frontmatter command injection, `git add .`,
  wrong tracker paths/status vocabulary, auto-merge. Even fixed, it cannot
  enforce — wrong side of the trust boundary.
- **B. Agent-side MCP server (rejected as authority, accepted as UX):** same
  trust boundary as A; valuable only as the plane-3 ergonomic veneer.
- **C. Pure event-driven (rejected as complete solution):** cannot express
  promotion; would encode decisions as magic branch pushes.
- **D. Three-plane synthesis (accepted):** B's ergonomics on plane 3, C's
  event derivation on plane 1, existing PR Finalizer as plane 2.

## Consequences

**Positive:** the "optimistic completion" violation class is structurally
impossible; tracker drift self-heals from git history (re-runnable projection);
agents lose all bureaucratic write authority; SOP shrinks for agents (Steps 2/9
become tool calls).

**Negative / costs:** bot write-backs to `main` need loop protection
(`[skip ci]`, path filters) and a branch-protection carve-out for the bot
identity; workflow YAML becomes critical infrastructure (mitigated by
CODEOWNERS above); local tracker state lags remote merges (acceptable — `main`
sync is already mandatory at slice start); promotion-decision provenance must
be recorded in the promotion PR body since no git event captures "why".

## Verification (falsifiable, lands with NC-EG-05)

- Negative test: a PR that edits a tracker status cell without the bot identity
  fails the finalizer (only the bot may write `completed`).
- Negative test: merge of a branch not matching `codex/<promoted-slice>` does
  not produce a closeout commit and raises an alert.
- Replay test: re-running the projection over the last N merged PRs reproduces
  the tracker closeout table byte-identically.
- CODEOWNERS test: a PR touching `scripts/ent-gates/**` without code-owner
  review cannot merge (branch-protection setting verified in evidence).

## Open items

- Bot identity: GitHub App vs `GITHUB_TOKEN` (App preferred: scoped, auditable).
- Whether plane-1 writes statuses directly into the md tables or into a small
  `slices.json` the md renders from (decide in NC-EG-05 design).
- ADR numbering note: the read-model strategy ADR referenced by NC-CQ-01 is
  renumbered **ADR-007** (ADR-006 is reserved by NC-E5-03 key management).
