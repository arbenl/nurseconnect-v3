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
