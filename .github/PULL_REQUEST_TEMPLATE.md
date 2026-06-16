## Summary
- 

## Evidence
### Verify Slice
- [ ] Run root used for reviewer plan and gate logs: `tmp/multi-agent/verify-slice/<run-id>/`
- [ ] Reviewer plan: `tmp/multi-agent/verify-slice/<run-id>/reviewer-plan.md`
- [ ] Subagent handoff: `tmp/multi-agent/verify-slice/<run-id>/reviews/subagent-handoff.md`
- [ ] Subagent results: `tmp/multi-agent/verify-slice/<run-id>/reviews/subagent-results.md` or blocked/skipped reason:
- [ ] Model route preflight: `tmp/multi-agent/verify-slice/<run-id>/reviews/model-review-preflight.md` or non-strict skipped reason:
- [ ] Model access check: `tmp/multi-agent/verify-slice/<run-id>/reviews/model-review-access.md` or non-strict skipped reason:
- [ ] Plugin activation: `docs/runbooks/plugin_activation_policy.md` applied; activated/skipped plugins:
- [ ] NurseConnect QA evidence: `tmp/multi-agent/verify-slice/<run-id>/evidence/nurseconnect-qa.md`
- [ ] Model review evidence: `tmp/multi-agent/verify-slice/<run-id>/evidence/model-review.md`
- [ ] Selected reviewers:
- [ ] `MUST_FIX: 0 (none)`
- [ ] `pnpm modularity:guard -- --base <base-commit>` result:
- [ ] `pnpm verify-slice -- --run-root <run-root> --static` result:
- [ ] `pnpm verify-slice -- --run-root <run-root> --required-gates` result:
- [ ] `pnpm slice:evidence -- --run-root <run-root>` result:
- [ ] Codex senior review: `reviews/codex-senior-review.md`
- [ ] Tier 2/3 or AI/protected-surface with passing model access only: `pnpm slice:evidence -- --run-root <run-root> --require-reviewers "sonnet46,gemini" --require-model-preflight --require-model-access --require-model-review --require-subagent-results --require-codex-senior-review --require-debate --must-fix-disposition "<none|all fixed|rejected:reason>"` result:
- [ ] Blocked external-review disposition, if any:

### Required Gates
- [ ] `Type Check & Lint` result:
- [ ] `Unit Tests (jsdom)` result:
- [ ] `DB Integration Tests (node)` result:
- [ ] `E2E API Tests` result:
- [ ] `E2E UI Smoke Gate` result:
- [ ] `Sonar Coverage` result:
- [ ] `Sonar Quality Gate` result:
- [ ] `GitGuardian Security Checks` result:
- [ ] `PR Finalizer` result:

### Logs
- [ ] Logs path: `artifacts/<TASK_ID>/validation.log`
- [ ] Optional signature/output: `artifacts/<TASK_ID>/signature.json`

### Screenshots
- [ ] Screenshot path: `apps/web/test-results/<run-id>/screenshot-1.png`

### Runbook
- [ ] Runbook path: `docs/runbooks/<runbook>.md`

## Pilot guardrails
- [ ] No protected auth/routing/proxy/API contract files were changed.
- [ ] N/A: docs/config-only PR with no protected runtime route, auth, proxy, or API contract changes.
- [ ] Protected files are explicitly allowed below:
  - [ ] `path/to/file` (`reason`)

## Checklist
- [ ] I verified product flow behavior is unchanged.
- [ ] I included local run output for required checks in the evidence block.
- [ ] I fixed or technically rejected all `MUST_FIX` reviewer findings.
- [ ] I followed `docs/runbooks/slice_workflow.md`.
- [ ] I have read and agree to the merge gate policy.
