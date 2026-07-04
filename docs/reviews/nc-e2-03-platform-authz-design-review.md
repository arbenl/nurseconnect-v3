# NC-E2-03 Platform AuthZ Design Review

Date: 2026-06-05
Slice: `NC-E2-03 / platform-authz`
Packet: `docs/plans/nc-e2-03-platform-authz-design.md`
Run root: `tmp/multi-agent/design-review/nc-e2-03-platform-authz`

## Reviewer Routes

| Route | Status | Notes |
|---|---|---|
| `codex` | `blocked` | Local Codex CLI could not load config because `service_tier` used unsupported value `default`; receipt written to `tmp/multi-agent/design-review/nc-e2-03-platform-authz/reviews/codex.md`. |
| `claude` | `blocked` | Claude CLI was not logged in; receipt written to `tmp/multi-agent/design-review/nc-e2-03-platform-authz/reviews/claude.md`. |
| `gemini` | `blocked` | Gemini CLI required interactive authentication consent and closed MCP discovery; receipt written to `tmp/multi-agent/design-review/nc-e2-03-platform-authz/reviews/gemini.md`. |
| `copilot` | `blocked` | Copilot CLI had no authentication information; receipt written to `tmp/multi-agent/design-review/nc-e2-03-platform-authz/reviews/copilot.md`. |

## Debate Summary

The model-review runner completed and wrote:

- `tmp/multi-agent/design-review/nc-e2-03-platform-authz/reviews/debate.md`
- `tmp/multi-agent/design-review/nc-e2-03-platform-authz/reviews/debate.json`
- `tmp/multi-agent/design-review/nc-e2-03-platform-authz/reviews/model-review-manifest.json`

Because every external route was blocked, the debate is evidence of attempted
review and exact blockers, not external approval.

## Fable 5 Escalation Review

Date: 2026-07-03
Run root: `tmp/multi-agent/fable-5-enterprise-audit`
Route: `claude48` with `CLAUDE_48_REVIEW_MODEL=claude-fable-5`
Status: `complete`

Accepted findings for implementation:

- `AuthorizedTransition` must carry request id, actor id, expected `from`
  status, target status, and action, not just a branded string.
- Transition persistence must re-check expected status under compare-and-set.
  Stale proof must produce deterministic conflict.
- Runtime proof tokens must resist structural forgery; object spread, JSON
  round-trip, and plain structural objects must not validate as proof.
- Raw status-write guards should cover Drizzle update sites outside the owning
  request-domain transition authority.
- Later route adapters must derive tenant/resource context server-side from
  platform identity and membership helpers, never from raw client input.

## Accepted Local Findings

- Deny reason codes must not include PHI, patient names, addresses, clinical
  notes, or raw resource identifiers.
- Later adapters must derive tenant/resource ownership, PHI fields,
  branch/facility ids, and jurisdiction markers server-side. The platform-authz
  package must not establish a pattern where clients declare trusted resource
  descriptors.
- Branch/facility scope semantics must distinguish an omitted scope list from an
  explicitly empty list; empty list means no scoped resource access.
- Deny precedence must be deterministic and tested so cross-tenant and missing
  subject cases do not leak resource facts through later adapters.
- The implementation PR must not claim blocked model-review routes as approval.

## Rejected Findings

- None. No external reviewer produced substantive findings.

## Remaining Risks

- Independent Claude/Gemini/Copilot review remains missing until the local CLI
  authentication/config blockers are resolved or the user explicitly waives that
  advisory signal.
- Implementation must stay pure-policy only. Route adoption, tenant-session
  selection, schema/RLS changes, PHI audit/encryption, branch/facility schema,
  jurisdiction policy, and product behavior remain separate future slices.
- The action union may still be too broad. Implementation should prefer the
  smallest action set that satisfies the required policy matrix and should
  reject extra product workflow actions until route adoption needs them.
