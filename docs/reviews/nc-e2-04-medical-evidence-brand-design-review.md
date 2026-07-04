# NC-E2-04 Medical Evidence Brand Design Review

Date: 2026-07-04
Slice: `NC-E2-04 / medical-evidence-brand`
Packet: `docs/plans/nc-e2-04-medical-evidence-brand-design.md`
Run root: `tmp/multi-agent/design-review/nc-e2-04-medical-evidence-brand`

## Reviewer Routes

| Route | Status | Notes |
|---|---|---|
| `nurseconnect_qa` | `blocked` | No callable repo-scoped MCP namespace was exposed in this Codex session; fallback used targeted source reads. |
| `claude48` | `complete` | Fable 5 via `CLAUDE_48_REVIEW_MODEL=claude-fable-5`; preflight, access-check, and debate completed. |

## Debate Summary

The model-review runner wrote:

- `tmp/multi-agent/design-review/nc-e2-04-medical-evidence-brand/reviews/claude48.md`
- `tmp/multi-agent/design-review/nc-e2-04-medical-evidence-brand/reviews/debate.md`
- `tmp/multi-agent/design-review/nc-e2-04-medical-evidence-brand/reviews/model-review-manifest.json`

Verdict was `NOT READY UNTIL MUST_FIX DISPOSITION`; all substantive findings
were from Fable 5 and were accepted unless noted below.

## Accepted Findings

- Credential proof payloads must bind branded `OrganizationId`; current
  `nurses` schema lacks `organization_id`, so DB predicate enforcement remains
  deferred to `NC-TB-01` and is called out as a limitation.
- Credential and medical evidence constructors must require a branded
  `PolicyDecision` and call `assertTenantActionAllowed` before minting proof.
- The design must not copy the one-time proof-consumption claim from legacy
  helpers unless the implementation actually consumes the `WeakSet` entry.
- Compare-and-set is mandatory; stale proof must deterministically raise a
  credential conflict.
- The self-service raw-status allowlist must enumerate exact files/statuses and
  be covered by architecture guard tests.
- Add rollback text, nurse-id mismatch tests, and a type-level `MedicalEvidence`
  forgery test.

## Rejected Or Deferred Findings

- Fixing the legacy `domain-referral` one-time consumption mismatch is deferred;
  this slice will avoid duplicating the false claim instead of expanding into
  quarantined referral debt.
- Adding `organization_id` to `nurses` is deferred to `NC-TB-01`; this slice
  binds organization in proof/authz context without schema changes.
