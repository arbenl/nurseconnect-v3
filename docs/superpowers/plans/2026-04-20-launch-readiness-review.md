# M5: Launch Readiness Review — Implementation Plan

> **Branch:** `codex/launch-readiness-review`
> **Depends on:** `main` with M4 merged via PR #52
> **Migration:** none

## Overview

Codify the NurseConnect v1.0.0 launch readiness review as a documentation and
verification slice. This does not change product behavior. It creates a
repeatable launch-readiness artifact and a lightweight verifier that checks the
repo still contains the launch-critical docs, scripts, and test entry points.

## Scope

- Add a launch readiness runbook.
- Add a launch day operator card.
- Record in-scope and out-of-scope v1.0.0 capabilities.
- List production preconditions and manual rehearsal steps.
- Add a local verifier command for launch readiness.
- Add a guarded, idempotent rehearsal seed script for non-production rehearsal
  databases.
- Keep the slice isolated from app runtime behavior.

## Out Of Scope

- New product features.
- New database migrations.
- Production deployment automation.
- Payment processor integration.
- Advanced service-area capacity controls.

## Implementation Steps

1. Add `docs/runbooks/launch_readiness_review.md`.
2. Add `docs/runbooks/launch_day_card.md`.
3. Add `scripts/launch-readiness-report.mjs`.
4. Add `scripts/launch-rehearsal-seed.mjs`.
5. Add `pnpm launch:readiness`, `pnpm launch:readiness:json`, and
   `pnpm launch:seed` to the root package scripts.
6. Validate the verifier locally.
7. Run focused static validation before PR.

## Acceptance Criteria

- `pnpm launch:readiness` exits zero and prints every readiness check.
- `pnpm launch:readiness:json` exits zero and prints structured JSON.
- `pnpm launch:seed` is present, idempotent, and guarded against production
  database names.
- The runbook includes production preconditions, scope truth, validation
  commands, manual rehearsal, go/no-go checklist, and rollback guidance.
- The verifier checks for launch-critical scripts, docs, and test entry points.
- No app runtime behavior changes are included.

## Validation

```bash
pnpm launch:readiness
pnpm launch:readiness:json
pnpm -w type-check
pnpm lint
```

Full PR validation should still use:

```bash
pnpm gate:release
```
