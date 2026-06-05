# Plugin Activation Policy

Use this policy before selecting tools for NurseConnect development. It maps the
available Codex plugins to the slices where they speed delivery or improve
quality. Repo-local MCP wiring in `.codex/config.toml` still wins over generic
plugin assumptions.

## Safety Rules

- Do not send secrets, tokens, PHI, patient details, production rows, clinical
  notes, raw addresses, or payment identifiers to plugins.
- Prefer repo-scoped MCP tools first: `nurseconnect_qa`, Playwright MCP, and
  `context7` when available.
- Record exact blockers when a plugin or CLI route is unauthenticated,
  unavailable, quota-limited, or missing from the active runtime.
- Do not edit user-global Codex configuration to activate NurseConnect tooling.
- For docs-only slices, keep plugin use lightweight and explain any reduced
  review scope in PR evidence.

## Default Engineering Activations

| Plugin | Activate When | Value |
|---|---|---|
| GitHub | PRs, checks, reviews, comments, merge, branch cleanup | Faster CI triage and closeout evidence. |
| Browser | Localhost UI validation, screenshots, accessibility snapshots | Better frontend verification than shell-only checks. |
| Superpowers | Multi-step implementation, TDD, debugging, branch finishing | More disciplined planning and verification. |
| Codex Security | Auth, tenancy, RLS, PHI, secrets, CI gates, dependency risk | Deeper security review before PR. |

## Conditional High-Value Activations

| Plugin | Activate When | Value |
|---|---|---|
| Sentry | Observability, runtime errors, release risk, post-merge incidents | Links code changes to production failure evidence. |
| Vercel | Preview/prod deploys, env drift, build/runtime logs | Faster deployment and environment diagnosis. |
| Supabase | Supabase-managed Postgres projects, SQL, RLS advisors, DB logs | Direct database evidence when project is configured. |
| Figma | Admin console, dashboards, mobile-responsive UI, design review | Higher-quality UI before coding. |
| Data Analytics | KPI definitions, launch reports, ops dashboards, market sizing | Stronger quantitative product/ops evidence. |
| PolicyNote | Jurisdiction, HIPAA/GDPR, BAA/DPA, vendor or data-residency questions | Better legal/regulatory framing before architecture decisions. |

## Request-Or-Scope-Only Activations

| Plugin | Activate When | Value |
|---|---|---|
| Notion | User asks to sync or update external tracker/docs | Keeps external program state aligned. |
| Linear | User references Linear issues/projects | Pulls external issue context into slice planning. |
| Slack | User asks for Slack summaries or messages | Communication support without repo changes. |
| Documents | Formal Word/Google Docs artifacts are requested | Produces shareable non-repo documents. |
| Presentations | Decks, slides, stakeholder briefings are requested | Produces polished presentations. |
| Spreadsheets | Financial models, vendor matrices, tabular planning are requested | Better structured analysis artifacts. |
| Canva | Marketing/social/brand assets are requested | Visual asset production, not engineering gating. |
| OpenAI Developers | OpenAI API, Agents SDK, ChatGPT Apps, or API-key workflows are in scope | Current OpenAI product guidance and setup. |
| Build iOS Apps | Native iOS/mobile simulator work is in scope | Uses Xcode/simulator-specific workflows. |

## Slice-Type Defaults

- Tier 0 docs/tracker: GitHub; add Notion only when external sync is requested.
- Tier 1 tooling/gates: GitHub, Superpowers, Codex Security; add Browser only
  for UI/dev-server validation.
- Tier 2 API/UI/workflow: GitHub, Browser, Superpowers; add Figma for UI design
  and Sentry/Vercel when deployed behavior or logs matter.
- Tier 3 auth/tenancy/RLS/PHI/schema/outbox/audit: GitHub, Superpowers, Codex
  Security, Sentry when runtime evidence exists, PolicyNote for legal or
  jurisdiction questions, Supabase only if the backing project is configured.
- AI-affected: OpenAI Developers plus Codex Security; run model-review access
  checks before relying on external critique, and record blocked routes instead
  of counting them as approval.
- Quota fallback: when external review is helpful but full debate is too heavy
  or Claude/Gemini quota is exhausted, use `pnpm model-review -- --fallback-ladder`
  with `sonnet46,gemini,copilot`. Add `claude47,claude48` only for escalations. It records blocked
  attempts and stops at the first completed review.

## Activation Evidence

For PRs, state the plugin choice in the Evidence section when it materially
changed the work:

```text
Plugin activation: GitHub + Codex Security + PolicyNote
Reason: Tier 3 auth/tenancy slice with jurisdiction risk.
Blocked routes: Gemini CLI unavailable; recorded in docs/reviews/...
```

If no plugin beyond repo-local MCP tooling was needed, say:

```text
Plugin activation: repo-local MCP/GitHub only; no external plugin evidence needed.
```
