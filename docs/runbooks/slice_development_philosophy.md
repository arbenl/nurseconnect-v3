# NurseConnect Slice Development Philosophy

This is the NurseConnect adaptation of the Interdomestik slice philosophy. It is a system-engineering contract: architecture changes only land when they are bounded, falsifiable, reviewed, and tied to program truth.

## Core Belief

Enterprise readiness is not achieved by one large rewrite. It is achieved by making each forbidden failure mode impossible to express, one slice at a time, with a test or guard that fails when the old behavior returns.

## Principles

1. **One canonical source of truth.**
   Current phase, next slice, and sequencing live in `docs/plans/current-program.md` and `docs/plans/current-tracker.md`. Other docs provide evidence or design detail, not competing authority.

2. **Guardrails before migrations.**
   Before broad tenancy, RLS, outbox, CRM, or compliance work, land cheap checks that freeze the regression surface: identity invariants, boundary guards, env checks, repo hygiene, and DR evidence.

3. **Smallest valuable slice.**
   A slice must advance one program invariant and avoid adjacent work. If the change needs multiple unrelated explanations, it is too large.

4. **Explicit non-scope.**
   Every slice should state what it does not authorize: schema, auth, tenancy, routing, PHI, notifications, outbox, UI, or product behavior when those are not directly in scope.

5. **Falsifiable acceptance criteria.**
   Exit criteria must be checkable by a reviewer: a test, script, migration proof, E2E path, audit artifact, or deterministic command result.

6. **Mechanism before shape.**
   Decide durable mechanisms first when customer shape is unknown. For NurseConnect: shared-schema RLS can be decided before flat org vs org+branch.

7. **Domain-neutral reuse only.**
   Interdomestik platform patterns can be copied and owned. Interdomestik business semantics cannot be imported into clinical staffing.

8. **Post-commit side effects.**
   External side effects such as notifications never run inside critical DB transactions. Reliable delivery comes later through an outbox.

9. **PHI-safe by default.**
   Until compliance decisions are closed, notifications, logs, tests, and review packets must avoid patient-identifying or clinical detail.

10. **Review is part of delivery.**
    `pnpm verify-slice`, reviewer prompts, `MUST_FIX` handling, and required gates are not ceremony. They are the safety system around small slices.

11. **Design is reviewed before code.**
    A slice design should be challenged by configured external reviewers before implementation starts. Claude, Gemini Pro, and Copilot Pro+ are advisory reviewers; repo evidence and deterministic gates remain the authority.

12. **Merge is not the finish line.**
    A slice is complete only after the PR is green and merged, local `main` is synced, the branch is deleted, closeout evidence is recorded, and the next slice is promoted from clean `main`.

## Slice Anatomy

Each implementation slice should have:

- tracker ID and branch name
- why now
- precise scope
- explicit non-scope
- files/areas likely touched
- risk tier
- rollback or mitigation note
- focused tests
- required verification commands
- reviewer evidence path
- PR, closeout, and promotion evidence path

## Enterprise Milestone Bias

Prefer this order:

1. identity correctness
2. repo/program guardrails
3. tenant isolation mechanism
4. authorization context
5. safe notifications
6. durable events/outbox
7. CRM primitives
8. PHI audit/encryption/compliance
9. platform APIs/integrations

This order is intentionally conservative. It makes later enterprise features cheaper and safer instead of making early demos look more complete.
