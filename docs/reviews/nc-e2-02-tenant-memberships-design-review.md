# NC-E2-02 Tenant Memberships Design Review

Date: 2026-06-04
Slice: `NC-E2-02 / tenant-memberships`
Packet: `docs/plans/nc-e2-02-tenant-memberships-design.md`
Run root: `tmp/multi-agent/design-review/nc-e2-02-tenant-memberships`

## Reviewer Routes

| Route | Status | Notes |
|---|---|---|
| `codex` | `blocked` | Local Codex CLI rejected `service_tier` config value; treated as missing advisory signal, not approval. |
| `claude` | `complete` | Required preserving membership audit evidence, fail-closed RLS policy wording, and closed bootstrap decisions. |
| `gemini` | `complete` | Required not grouping referral partners into one default organization; recommended adding facilities now. |
| `copilot` | `complete` | Required explicit active-status whitelisting, timestamp maintenance, and organization lifecycle/deactivation guidance. |

## Accepted Findings

- `organization_memberships.user_id` uses `on delete restrict` so membership
  rows remain access evidence unless a later legal/privacy erasure procedure
  explicitly owns hard deletion.
- RLS policy guidance now names a fail-closed `current_setting` predicate and
  forbids `OR current_setting(...) IS NULL` style widening.
- Existing global `admin` users map to default-org `owner`; existing
  `referral_partner`, `patient`, and `nurse` users do not receive default tenant
  authority in this slice.
- Authorization helpers must whitelist `status = 'active'`.
- `updated_at` maintenance, actor attribution, activation timestamp, membership
  source, slug format, bounded list queries, and unset-tenant negative tests are
  now required.

## Rejected Findings

- Adding a minimal facility table in `NC-E2-02` is rejected for this slice.
  ADR-001 still requires organization plus facility before care-site
  transactional ownership, but adding a half-designed facility table here would
  couple membership work to facility membership, jurisdiction, and branch-scoped
  authorization before those boundaries are designed together.

## Remaining Risks

- The next implementation slice must keep membership implementation narrow and
  must not make care data tenant-owned incidentally.
- Facility, jurisdiction, tenant nurse context, and platform AuthZ still require
  later design/implementation slices before multi-country or care-site
  production behavior is expanded.
