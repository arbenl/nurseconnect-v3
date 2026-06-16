# NurseConnect Code Review

Use this guidance for every NurseConnect slice review. It complements
`AGENTS.md`, `docs/runbooks/slice_workflow.md`, and the generated
`verify-slice` reviewer plan.

## Review Priority

Findings must focus on defects that can change production behavior, weaken a
mandate, leak PHI, break tenant isolation, or invalidate slice evidence.
Style-only comments are not blocking unless they hide one of those risks.

## Blocking Findings

Mark a finding `MUST_FIX` when it involves:

- bare-row mutations without co-committed audit/event evidence
- cross-domain SQL joins or imports outside owned contracts/read models
- raw string state writes outside owning transition constructors
- PHI in logs, notifications, model packets, tests, screenshots, or PR evidence
- auth, tenancy, RLS, payment, notification, or clinical workflow bypasses
- missing or misleading `verify-slice`, model-review, reviewer, or PR evidence
- gate changes that relax checks without an explicitly authorized slice
- production side effects inside critical DB transactions

## Reviewer Discipline

- Review only the promoted slice scope and directly impacted code.
- Treat `AGENTS.md` and current tracker/program authority as higher priority
  than older docs or implementation habits.
- Do not count blocked model routes as approval. Record the blocker reason.
- If Codex review is quota-limited or silent, do not retry it repeatedly in the
  same slice; use configured external reviewers and deterministic gates.
- Rejected findings need a technical rationale tied to code or gate evidence.

## Evidence Expectations

Before PR readiness, the branch should have:

- active slice, risk tier, branch readiness, and protected-scope status recorded
- focused proof for the changed behavior
- `pnpm verify-slice`, static proof, required gates, and slice evidence
- reviewer pool results with every `MUST_FIX` fixed or rejected
- PR body links to run-root evidence and closeout requirements

## Non-Blocking By Default

Do not block on broad refactors, adjacent roadmap ideas, naming preferences, or
nice-to-have coverage unless they are required to prove the active slice.
