# NurseConnect Slice Runner Skill Specification

This is a repo-local adaptation of the Interdomestik slice-runner operating model. It is not installed as a global skill by default; it defines the behavior future agents should follow when running NurseConnect enterprise-readiness slices.

## Trigger

Use this runner when the user asks to run, continue, implement, ship, or review the next NurseConnect enterprise slice.

## Source Of Truth

Read these first, in order:

1. `AGENTS.md`
2. `docs/plans/current-program.md`
3. `docs/plans/current-tracker.md`
4. `docs/plans/nurseconnect-enterprise-architecture-program.md`
5. `docs/plans/nurseconnect-enterprise-architecture-tracker.md`
6. `docs/runbooks/slice_development_philosophy.md`
7. relevant ADRs under `docs/adr/`
8. `docs/runbooks/slice_workflow.md`

## Non-Negotiables

- Do not assume Interdomestik repo tools apply to NurseConnect unless NurseConnect wires them locally.
- Do not edit user-global Codex config for NurseConnect.
- Do not implement more than one tracker slice per branch.
- Do not start implementation until the slice design is reviewed by configured external reviewers or explicitly waived by the user.
- Do not start tenant/RLS schema work before `NC-E0-01` identity hardening is complete.
- Do not assume org→branch until `NC-E1-01` closes.
- Do not place notification provider calls inside request allocation transactions.
- Do not include PHI in notifications until compliance/vendor decisions are closed.
- Do not copy Interdomestik business domains into NurseConnect.
- Do not promote a slice without falsifiable acceptance criteria.

## Slice Selection

Choose the first `ready` item in `docs/plans/current-tracker.md`, then confirm its detailed row in `docs/plans/nurseconnect-enterprise-architecture-tracker.md`.

If no item is `ready`, stop and report the blocking decision.

## Implementation Flow

Follow `docs/runbooks/slice_workflow.md`:

1. Clean synced `main`.
2. Draft a bounded slice design.
3. Request Codex/Claude/Gemini/Copilot review with `pnpm model-review -- --debate` when the slice needs deeper critique, or record blockers.
4. Apply accepted design feedback before branch creation.
5. Fresh `codex/<slice-name>` branch.
6. Focused implementation.
7. Focused local tests.
8. `pnpm verify-slice`.
9. `pnpm verify-slice -- --run-root <run_root> --static`.
10. Confirm MCP preflight, Sentinel, Sonar advisory, and Sentry advisory evidence under `run_root`.
11. Reviewer pool.
12. Fix or reject `MUST_FIX`.
13. `pnpm verify-slice -- --run-root <run_root> --required-gates`.
14. PR, CI/Sonar/Copilot/finalizer monitoring, merge, main sync, branch deletion.
15. Closeout evidence and next-slice promotion only from clean synced `main`.

## Risk Tier Defaults

- Docs/tracker only: Tier 0.
- Narrow identity/env/repo hygiene: Tier 1.
- Notifications/UI/API behavior: Tier 2.
- Auth, tenancy, schema, RLS, outbox, audit, PHI, compliance: Tier 3.

Tier 3 slices require especially explicit rollback and verification evidence.

## Gate Weight

`verify-slice` is mandatory for repo slices, but gate weight follows scope:

- Tier 0 docs/tracker-only slices run docs/static hygiene required gates instead
  of local `pnpm gate:release`.
- Non-docs implementation, tooling, runtime, schema, auth, PHI, and CI/gate
  slices still run full required local release gates before PR.
- CI, branch protection, GitGuardian, Sonar, PR Finalizer, and required review
  outcomes remain authoritative after PR creation.

## Critique Debate

Use `pnpm model-review -- --packet <design-packet.md> --run-root <run_root> --debate`
when a slice benefits from multi-model critique: Tier 2/Tier 3, AI-affected
slices, broad Tier 1 tooling/gate changes, or reviewer disagreement.

The debate is advisory evidence. It must not receive PHI, secrets, raw
production data, patient details, or unnecessary clinical details.
