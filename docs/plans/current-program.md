---
plan_role: canonical_program
status: active
source_of_truth: true
owner: platform
last_reviewed: 2026-06-05
tracker_path: docs/plans/current-tracker.md
architecture_program_path: docs/plans/nurseconnect-enterprise-architecture-program.md
architecture_tracker_path: docs/plans/nurseconnect-enterprise-architecture-tracker.md
verification_command: pnpm verify-slice
---

# NurseConnect Current Program

> Authority: This is the repo-canonical source of truth for the current NurseConnect enterprise-readiness execution program. If another planning document disagrees with this file, this file wins until deliberately updated.

## Active Program

NurseConnect is executing the **Enterprise Architecture Finalization** program. The goal is to evolve the current single-tenant modular monolith into an enterprise-ready, healthcare-safe platform while preserving the existing slice workflow and avoiding a big-bang rewrite.

The active architecture program is:

- Program: `docs/plans/nurseconnect-enterprise-architecture-program.md`
- Tracker: `docs/plans/nurseconnect-enterprise-architecture-tracker.md`
- ADRs: `docs/adr/ADR-001-tenant-model.md`, `ADR-002-identity-model.md`, `ADR-003-authorization-model.md`, `ADR-004-outbox-and-jobs.md`
- Baseline report: `docs/enterprise-readiness-report.md`
- Phase 0 slice plan: `docs/plans/phase-0-stabilization-slices.md`
- Slice philosophy: `docs/runbooks/slice_development_philosophy.md`

## Program Invariants

- **Do not implement the whole target architecture at once.** Every change must be a bounded slice.
- **Identity hardening precedes tenancy.** `users.auth_id` must be reconciled and enforced before tenant membership becomes authoritative.
- **Tenant isolation uses shared-schema Postgres RLS as the target mechanism.** Tenant shape is organization plus branch/facility/location from v1; country/jurisdiction is a compliance and operating scope, not the tenant boundary.
- **Interdomestik is a reference, not a dependency.** Copy-and-own platform patterns where useful; do not import business-domain assumptions.
- **Outbox persistence is net-new NurseConnect work.** Interdomestik provides an interface/test reference, not a complete persisted implementation.
- **Notifications are post-commit and non-PHI until compliance/vendor decisions are complete.**
- **Clinical compliance is a program layer, not a single feature.** PHI read audit, field encryption, retention, consent, BAA/vendor review, and incident response must be handled explicitly.
- **Slice acceptance must be falsifiable.** Every promoted slice needs a checkable exit criterion: test, script, migration proof, E2E path, audit artifact, or deterministic command result.
- **Implementation starts after design review.** Claude, Gemini Pro, and Copilot Pro+ reviewer feedback is advisory evidence when callable or user-provided; accepted findings update the slice design before branch creation.
- **Promotion happens after clean merge closeout.** A slice is complete only after the PR is green and merged, `main` is synced, the feature branch is deleted, evidence is recorded, and the next slice is promoted from clean `main`.

## Current Phase

The active phase is **NC-E2: Identity/AuthZ Platform**.

Phase 0 was intentionally boring: close cheap high-assurance gaps before schema-wide tenancy, CRM, outbox, or compliance work.

Completed closeout evidence:

- `NC-E0-01 / phase-0-identity-link` merged in PR #73 on 2026-06-02.
- Merge commit: `d636a890288955c0b5a5767c05956310d4a89bfb`.
- Required checks passed: `Type Check & Lint`, `Sonar Coverage`, `Sonar Quality Gate`, `Unit Tests (jsdom)`, `DB Integration Tests (node)`, `E2E API Tests`, `E2E UI Smoke Gate`, `PR Finalizer`, and `GitGuardian Security Checks`.
- `NC-E0-02 / production-email-verification` merged in PR #75 on 2026-06-02.
- Merge commit: `f534fd797378484820d42d612dcc94cbbdf48a33`.
- Required checks passed: `Type Check & Lint`, `Sonar Coverage`, `Sonar Quality Gate`, `Unit Tests (jsdom)`, `DB Integration Tests (node)`, `E2E API Tests`, `E2E UI Smoke Gate`, `PR Finalizer`, and `GitGuardian Security Checks`.
- Post-merge `main` CI harness regression was fixed in PR #76 on 2026-06-02 at `308d4d255f5da976480d591825d60b23953b7a34`; [`main` CI run #261](https://github.com/arbenl/nurseconnect-v3/actions/runs/26846870192) passed.
- `NC-E0-03 / env-secret-checks` merged in PR #78 on 2026-06-04.
- Merge commit: `ec3a0f7845b73235aaf3200528728beea873c754`.
- Required checks passed: CI, Sonar Quality Gate, Sonar PR Summary, Sonar Coverage, GitGuardian, PR Finalizer, API E2E, UI smoke, and the post-merge strict release gate.
- `NC-E0-04 / repo-hygiene` merged in PR #80 on 2026-06-04.
- Merge commit: `6ae17d68db4a86875b6049ddfccaedea82e15183`.
- Required checks passed: CI, Sonar Quality Gate, Sonar PR Summary, Sonar Coverage, GitGuardian, PR Finalizer, API E2E, and UI smoke.
- `NC-E0-05 / module-boundary-guard` merged in PR #82 on 2026-06-04.
- Merge commit: `505f8aae60cc3dbc7e19ef7384e1df94457d3b4c`.
- Required checks passed: CI, Sonar Quality Gate, Sonar PR Summary, Sonar Coverage, GitGuardian, PR Finalizer, API E2E, UI smoke, and local required release gate evidence.
- `NC-E0-06 / dr-baseline` merged in PR #84 on 2026-06-04.
- Merge commit: `d20bb12fd791f77af2f2d3b9bdfffe0e6d613811`.
- Required checks passed: CI, Sonar Quality Gate, Sonar PR Summary, Sonar Coverage, GitGuardian, PR Finalizer, API E2E, and UI smoke; docs-only local static and required gates passed.
- `NC-E1-01 / tenant-model-decision` merged in PR #86 on 2026-06-04.
- Merge commit: `bb801d748c797ac94489df3a52de327ffdbdb310`.
- Required checks passed: CI, Sonar Quality Gate, Sonar PR Summary, Sonar Coverage, GitGuardian, PR Finalizer, API E2E, and UI smoke.
- `NC-E1-02 / rls-platform-mechanism` merged in PR #87 on 2026-06-04.
- Merge commit: `14c522558b630eb1ff3a2760dd27cac858ea0a8c`.
- Required checks passed: CI, Sonar Quality Gate, Sonar PR Summary, Sonar Coverage, GitGuardian, PR Finalizer, API E2E, UI smoke, focused database type/unit/DB tests, architecture boundary guard, verify-slice static, and verify-slice required gates.
- `NC-E1-03 / default-tenant-backfill-plan` merged in PR #89 on 2026-06-04.
- Merge commit: `15a6c9ebe688a6174a1e5620e33ffd986f90e04d`.
- Required checks passed: CI, Sonar Quality Gate, Sonar PR Summary, Sonar Coverage, GitGuardian, PR Finalizer, API E2E, UI smoke, model-review disposition, verify-slice static, and verify-slice required gates.
- `NC-E1-04 / tenant-isolation-tests` merged in PR #91 on 2026-06-04.
- Merge commit: `81035fad9d1fea3e17c0d43731d8ab9fdcf31901`.
- Required checks passed: CI, Sonar Quality Gate, Sonar PR Summary, Sonar Coverage, GitGuardian, PR Finalizer, API E2E, UI smoke, tenant-isolation readiness/guard harness checks, focused DB context tests, model-review disposition, verify-slice static, and verify-slice required gates.
- `NC-E2-01 / platform-identity` merged in PR #93 on 2026-06-04.
- Merge commit: `b46861d353cc196ffbfaf1a456952414ff28bae0`.
- Required checks passed: CI, Sonar Quality Gate, Sonar PR Summary, Sonar Coverage, GitGuardian, PR Finalizer, API E2E, UI smoke, central current-user resolver tests, AST current-user boundary guard, Copilot finding fixes, model-review disposition, verify-slice static, and verify-slice required gates.
- `NC-E2-02 / tenant-memberships` merged in PR #96 on 2026-06-05.
- Merge commit: `b0fa47381b3daa6db2c744cbc80b20a59ffdd54f`.
- Required checks passed: CI, Sonar Quality Gate, Sonar PR Summary, Sonar Coverage, GitGuardian, PR Finalizer, API E2E, UI smoke, focused identity unit/DB tests, tenant-isolation contract tests, model-review disposition, Copilot finding fix, verify-slice static, verify-slice required gates, and pre-push strict release gate.

Phase 0 stabilization is complete. `NC-E1-01 / tenant-model-decision` closed
ADR-001 Decision B:

```text
Tenant shape: organization plus branch/facility/location
```

Decision scope:

- customer demand is tenant/facility scoped
- nurse supply is platform-level only for non-PHI routing identity
- nurse eligibility, credentials, consent, assignment participation, visit access,
  and audit evidence are tenant/facility/jurisdiction scoped
- country/jurisdiction is a compliance and operating scope, not tenant boundary
- multi-country production rollout requires regional/data-residency topology review
  before launch

The next implementation slice is:

```text
NC-E2-03 / codex/platform-authz
```

## Slice Execution Contract

All implementation slices follow `docs/runbooks/slice_workflow.md` and `AGENTS.md`:

1. Start from clean synced `main`.
2. Draft the slice design and request configured external review.
3. Apply accepted design feedback before branch creation.
4. Create one `codex/<slice-name>` branch.
5. Implement only the promoted slice.
6. Run focused checks while developing.
7. Run `pnpm verify-slice` and keep `run_root`.
8. Run `pnpm verify-slice -- --run-root <run_root> --static`.
9. Run reviewer pool from the generated reviewer plan.
10. Fix or technically reject every `MUST_FIX`.
11. Run `pnpm verify-slice -- --run-root <run_root> --required-gates`.
12. Open one PR with evidence.
13. Monitor CI/Sonar/Copilot/reviews until all required checks are green.
14. Merge, sync `main`, delete branch, record closeout, then promote the next slice.
