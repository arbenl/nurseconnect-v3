---
artifact_type: fable5_callable_audit_packet
project: nurseconnect-v3
date: 2026-07-06
status: setup_packet
authority: advisory
packet_version: "2026-07-06.2"
schema_version: "nc-ent-fable5-output-v1"
model_route: claude48_with_claude_fable_5
payload_scope: sanitized_repo_packet_only
---

# NurseConnect Fable 5 Enterprise Audit Packet

This is a callable audit packet for Fable 5. It is not a verdict, tracker, slice
promotion, launch approval, or current authority.

Repo authority remains:

1. `docs/plans/current-program.md`
2. `docs/plans/current-tracker.md`
3. `docs/plans/ENTERPRISE_UPGRADE_TRACKER.md`
4. `AGENTS.md`
5. `nurseconnect-execution-runner`
6. `docs/runbooks/slice_playbook_scorecard.md` and `code_review.md`

Fable 5 output is advisory evidence only. It cannot override repo authority,
source code, tests, gates, trackers, PHI rules, or the active slice workflow.

Advisory-derived artifacts must remain under `docs/reviews/` unless and until
the repo authority chain deliberately adopts them. No advisory artifact may be
cited from `docs/plans/current-program.md`, `docs/plans/current-tracker.md`, or
`docs/plans/ENTERPRISE_UPGRADE_TRACKER.md` without a separate adoption commit
that records reviewer disposition, validation evidence, and the exact adopted
scope.

Authorization path: this packet is out-of-band advisory review setup requested
by Arben. It is not an implementation slice and does not promote or complete a
tracker row. A PR that lands this packet should be reviewed as docs-only
advisory evidence; any later adoption into `docs/plans/` must follow the
current NurseConnect slice workflow and authority chain.

## Read Context

Obsidian advisory context read:

- `/Users/arbenlila/Documents/Knowledge Manager and Systems Architect/AGENTS.md`
- `/Users/arbenlila/Documents/Knowledge Manager and Systems Architect/Wiki/Home.md`
- `/Users/arbenlila/Documents/Knowledge Manager and Systems Architect/Wiki/projects/nurseconnect.md`
- `/Users/arbenlila/Documents/Knowledge Manager and Systems Architect/Wiki/cross-project-concepts/healthcare-phi-compliance.md`
- `/Users/arbenlila/Documents/Knowledge Manager and Systems Architect/Wiki/cross-project-concepts/tenant-auth-routing.md`
- `/Users/arbenlila/Documents/Knowledge Manager and Systems Architect/Wiki/cross-project-concepts/evidence-gates-ci.md`
- `/Users/arbenlila/Documents/Knowledge Manager and Systems Architect/Wiki/cross-project-concepts/billing-payments.md`
- `/Users/arbenlila/Documents/Knowledge Manager and Systems Architect/Wiki/cross-project-concepts/operations-runbooks.md`
- `/Users/arbenlila/Documents/Knowledge Manager and Systems Architect/Notes/decisions/codex-wiki-first-context.md`
- `/Users/arbenlila/Documents/Knowledge Manager and Systems Architect/Notes/reviews/fable-5-obsidian-upgrade.md`

`Notes/annotations/nurseconnect.md` was not present.

Payload boundary: Obsidian files above were used for human/Codex orientation
only. Their bodies are not included in the callable payload except for this
packet's explicit path list and summarized read-status notes. If a later Fable
5 exchange needs an Obsidian excerpt, that excerpt must be copied into a
sanitized relay packet and scanned by the same sensitive-pattern process before
being sent.

Repo authority and related evidence read:

- `AGENTS.md`
- `docs/plans/current-program.md`
- `docs/plans/current-tracker.md`
- `docs/plans/ENTERPRISE_UPGRADE_TRACKER.md`
- `docs/plans/nurseconnect-enterprise-architecture-program.md`
- `docs/plans/nurseconnect-enterprise-architecture-tracker.md`
- `docs/enterprise-readiness-report.md`
- `code_review.md`
- `docs/adr/ADR-001-tenant-model.md`
- `docs/adr/ADR-002-identity-model.md`
- `docs/adr/ADR-003-authorization-model.md`
- `docs/adr/ADR-004-outbox-and-jobs.md`
- `docs/adr/ADR-005-slice-lifecycle-automation.md`
- `docs/runbooks/slice_playbook_scorecard.md`
- `docs/runbooks/default-tenant-backfill-plan.md`
- `docs/runbooks/tenant-isolation-abuse-tests.md`
- `docs/runbooks/disaster-recovery.md`
- `docs/payments/payment-automation-boundary-design.md`
- `docs/commercial/commercial-model-spec.md`
- `docs/reviews/principal-critique-2026-06-02.md`
- `docs/reviews/nc-e2-04-medical-evidence-brand-design-review.md`

MCP status: repo-scoped `nurseconnect_qa` was not exposed in this Codex
session. The only visible QA MCP namespace was `interdomestik_qa`, which must
not be used for NurseConnect. Targeted `rg` and capped file reads were used as
fallback.
