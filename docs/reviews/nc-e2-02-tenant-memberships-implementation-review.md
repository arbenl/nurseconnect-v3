# NC-E2-02 Tenant Memberships Implementation Review

Date: 2026-06-05
Slice: `NC-E2-02 / tenant-memberships`
Run root: `tmp/multi-agent/verify-slice/verify-slice-20260605T045010Z-b2da6b`

## Reviewer Routes

| Route | Status | Notes |
|---|---|---|
| `codex` | `blocked` | Local CLI exited non-zero; treated as missing advisory signal, not approval. |
| `claude` | `blocked` | Timed out after 120 seconds; treated as missing advisory signal, not approval. |
| `gemini` | `blocked` | Produced partial stdout, then timed out after model-capacity 429s; findings were still reviewed. |
| `copilot` | `complete` | Returned implementation critique with blocker and hardening findings. |

## Accepted Findings

- Documented the intentional `organizations` RLS exemption in `config/tenant-isolation-contract.json`.
- Added `OrganizationInsufficientRoleError` so wrong-role membership checks are distinguishable from missing membership.
- Removed the `org_memberships.source` default so callers must write explicit membership lineage.
- Changed default organization bootstrap so an existing default organization is not renamed or reactivated by a rerun.
- Marked deferred isolation scenarios as `unimplemented` while keeping them visible in the contract.
- Changed membership helpers to require an explicit database executor; callers cannot silently fall back to global `db`.

## Rejected Or Deferred Findings

- Global organization membership discovery is deferred. `NC-E2-02` intentionally implements tenant-scoped membership helpers only; active-organization selection and any safe cross-tenant discovery path need a separate session/authz design because `resolveCurrentSessionUser()` must not auto-pick a tenant in this slice.
- RLS on `organizations` is deferred. The table is the tenant boundary and has no `organization_id` discriminator; no runtime organization-enumeration route is added in this slice. `org_memberships` is the tenant-owned table and is RLS-protected now.
- Full executable isolation scenarios for care/PHI/workflow tables remain deferred until those tables receive tenant ownership columns and RLS policies.

## Verification After Disposition

- `pnpm --filter @nurseconnect/domain-identity type-check`
- `pnpm --filter @nurseconnect/domain-identity test`
- `pnpm --filter @nurseconnect/domain-identity test:db`
- `pnpm db:verify-meta`
- `pnpm tenant:isolation -- --mode guard --source drizzle`
- `pnpm exec vitest run scripts/__tests__/tenant-isolation-abuse.test.mjs`
