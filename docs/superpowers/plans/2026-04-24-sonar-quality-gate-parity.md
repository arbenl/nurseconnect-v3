# SonarCloud PR Quality Gate Parity Plan

## Slice

Branch: `codex/sonar-quality-gate-parity`

Goal: make Sonar a required pull-request quality gate for NurseConnect, with a
PR-facing summary and PR Finalizer enforcement.

## Checklist

- [x] Start from clean, synced `main`.
- [x] Create fresh branch.
- [x] Add `Sonar Quality Gate` to `.github/workflows/ci.yml`.
- [x] Keep scheduled/manual baseline workflow, but remove PR warn-mode drift.
- [x] Add narrow PR summary job for Sonar summaries.
- [x] Make PR Finalizer require `Sonar Quality Gate`.
- [x] Add script tests for workflow parity and comment generation.
- [x] Update runbooks and launch readiness references.
- [x] Run focused local checks.
- [x] Run `pnpm verify-slice`, static gate, and reviewer pool.
- [x] Run required gates.
- [ ] Open PR and fix CI/Sonar/Copilot feedback.
- [ ] Merge only after all required checks, including PR Finalizer, are green.
- [ ] Sync local `main`, update Notion, and delete local/remote branch.
