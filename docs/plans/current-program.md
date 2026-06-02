---
plan_role: canonical_program
status: active
source_of_truth: true
owner: platform
last_reviewed: 2026-06-02
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
- **Tenant isolation uses shared-schema Postgres RLS as the target mechanism.** Tenant shape remains a separate decision until first enterprise-customer model is confirmed.
- **Interdomestik is a reference, not a dependency.** Copy-and-own platform patterns where useful; do not import business-domain assumptions.
- **Outbox persistence is net-new NurseConnect work.** Interdomestik provides an interface/test reference, not a complete persisted implementation.
- **Notifications are post-commit and non-PHI until compliance/vendor decisions are complete.**
- **Clinical compliance is a program layer, not a single feature.** PHI read audit, field encryption, retention, consent, BAA/vendor review, and incident response must be handled explicitly.
- **Slice acceptance must be falsifiable.** Every promoted slice needs a checkable exit criterion: test, script, migration proof, E2E path, audit artifact, or deterministic command result.
- **Implementation starts after design review.** Claude, Gemini Pro, and Copilot Pro+ reviewer feedback is advisory evidence when callable or user-provided; accepted findings update the slice design before branch creation.
- **Promotion happens after clean merge closeout.** A slice is complete only after the PR is green and merged, `main` is synced, the feature branch is deleted, evidence is recorded, and the next slice is promoted from clean `main`.

## Current Phase

The active phase is **NC-E0: Program Operating System + Phase 0 Stabilization**.

Phase 0 is intentionally boring: close cheap high-assurance gaps before schema-wide tenancy, CRM, outbox, or compliance work.

The first implementation slice after this docs/process setup is:

```text
NC-E0-01 / phase-0-identity-link
```

Scope:

- reconcile `users.auth_id`
- define orphan policy
- make the auth/domain identity bridge enforceable
- add DB invariant tests

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
