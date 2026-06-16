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
9. `docs/runbooks/plugin_activation_policy.md`
10. `docs/runbooks/slice_playbook_scorecard.md`
11. `code_review.md`

## Non-Negotiables

- Do not use `interdomestik_qa`; NurseConnect owns `nurseconnect_qa` from `.codex/config.toml`, with `nurse_qa` as an alias.
- Do not edit user-global Codex config for NurseConnect.
- Do not implement more than one tracker slice per branch.
- Do not start implementation until the slice design is reviewed, explicitly waived by the user, or external reviewer blockers are recorded and deterministic local acceptance criteria are clear.
- Keep every new checked source, script, workflow, config, Markdown, and test file at or below 150 lines; touched oversized legacy files must not grow.
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
2. Report active slice, risk tier, branch readiness, protected-scope status,
   and explicit non-goals from the playbook scorecard.
3. Draft a bounded slice design.
4. Apply `docs/runbooks/plugin_activation_policy.md` to choose optional plugins.
5. Run model preflight/access checks, then debate when routes are callable.
6. Apply accepted design feedback before branch creation.
7. Fresh `codex/<slice-name>` branch.
8. Focused implementation and focused local tests.
9. `pnpm verify-slice`, then `pnpm verify-slice -- --run-root <run_root> --static`.
10. Confirm `nurseconnect_qa`, MCP preflight, modularity, Sentinel, Sentry,
    and applicable local Sonar evidence under `run_root`; PR Sonar remains blocking.
11. Reviewer pool; fix or reject every `MUST_FIX`.
12. `pnpm verify-slice -- --run-root <run_root> --required-gates`.
13. PR, CI/Sonar/review-bot/finalizer monitoring, merge, main sync, branch deletion.
14. Closeout evidence, measurement notes, and next-slice promotion only from clean synced `main`.

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

## NurseConnect QA

Use `nurseconnect_qa` or its `nurse_qa` alias for project map, code search,
branch status, scope audit, modularity audit, slice evidence audit, and
configured repo verification. If the active runtime exposes only another repo's
QA namespace, record that blocker, do not call it, and generate
`<run_root>/evidence/nurseconnect-qa.{json,md}`:

```text
RUN_ROOT=<run_root> BASE_REF=<base> node scripts/multi-agent/nurseconnect-qa-evidence.mjs
```

## Critique Debate

Before relying on model reviewers, run preflight and access checks for the
strict external default `sonnet46,gemini`. For Tier 2/Tier 3, AI-affected,
protected, or gate/tooling slices, use debate mode with those routes and keep
`reviews/model-review-preflight.*`,
`reviews/model-review-access.*`, `reviews/<reviewer>.{json,md}`,
`evidence/model-review.{json,md}`, and `reviews/debate.{json,md}`.
Escalate beyond the default only for high-trust
surfaces, unresolved disagreement, or user request.

```text
pnpm model-review -- --preflight --run-root <run_root> --reviewers sonnet46,gemini
pnpm model-review -- --access-check --run-root <run_root> --reviewers sonnet46,gemini
pnpm model-review -- --packet <design-packet.md> --run-root <run_root> --reviewers sonnet46,gemini --debate
RUN_ROOT=<run_root> node scripts/multi-agent/model-review-summary.mjs
```

Use `pnpm model-review -- --packet <design-packet.md> --run-root <run_root> --fallback-ladder`
only for lower-risk slices where one advisory review is enough or provider quota
is tight. The ladder records completed and blocked routes without treating blocked access as approval.

Protected-surface PR evidence with passing model access must include:

```text
pnpm slice:evidence -- --run-root <run_root> --require-reviewers "sonnet46,gemini" --require-model-preflight --require-model-access --require-model-review --require-subagent-results --require-debate --must-fix-disposition "<none|all fixed|rejected:reason>"
```

If model access is blocked, cite `reviews/model-review-access.*`, state blocked
routes were not counted as approval, still generate `evidence/model-review.*`
from any available-route review or explicit not-run summary, and keep
deterministic gates mandatory.

Codex is optional escalation evidence. If it is quota-limited, rate-limited, or
silent, record the blocker reason once and continue with the available external
routes instead of retrying it throughout the same slice.

The debate is advisory evidence. It must not receive PHI, secrets, raw
production data, patient details, or unnecessary clinical details.
