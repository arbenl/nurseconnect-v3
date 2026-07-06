---
artifact_type: fable5_callable_audit_packet_index
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

This is the index for the Fable 5 callable audit packet. The packet is split
into parts to satisfy the repo's new-file line limit.

This packet is not a verdict, tracker, slice promotion, launch approval, or
current authority. Fable 5 output is advisory evidence only and cannot override
repo authority, source code, tests, gates, trackers, PHI rules, or the active
slice workflow.

Repo authority remains:

1. `docs/plans/current-program.md`
2. `docs/plans/current-tracker.md`
3. `docs/plans/ENTERPRISE_UPGRADE_TRACKER.md`
4. `AGENTS.md`
5. `nurseconnect-execution-runner`
6. `docs/runbooks/slice_playbook_scorecard.md` and `code_review.md`

## Packet Parts

- `docs/reviews/2026-07-06-nurseconnect-fable5-enterprise-audit-packet-part-1.md`
- `docs/reviews/2026-07-06-nurseconnect-fable5-enterprise-audit-packet-part-2.md`
- `docs/reviews/2026-07-06-nurseconnect-fable5-enterprise-audit-packet-part-3.md`
- `docs/reviews/2026-07-06-nurseconnect-fable5-enterprise-audit-packet-part-4.md`
- `docs/reviews/2026-07-06-nurseconnect-fable5-enterprise-audit-packet-part-5.md`
- `docs/reviews/2026-07-06-nurseconnect-fable5-enterprise-audit-packet-part-6.md`

## Adoption Boundary

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
