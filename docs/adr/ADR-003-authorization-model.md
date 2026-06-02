# ADR-003: Authorization Model (RBAC → tenant-scoped ABAC)

**Status:** Proposed
**Date:** 2026-06-02
**Related:** ADR-001 (tenancy), ADR-002 (identity); report §2.6, §3 R5, §9 Phase 1

## Context

Authorization today is a **single flat enum** `user_role` on `users` (`admin|nurse|patient|referral_partner`), checked by role-equality via `domain-identity` policies (`requireRole`, `requireAnyRole`, `resolvePortalAccessPolicy`) wired through `apps/web/src/server/auth/*`. There is no permission table, no resource-scoped grant, no org scoping. This is adequate for a 4-persona single-tenant app but cannot express enterprise needs: "coordinator at Org A (read-write), read-only at Org B," or "agency admin may reassign requests only within their branch."

Interdomestik faced the same and landed on a pragmatic answer worth noting: it **deprecated its `user_roles` table for runtime** and moved authorization to **session claims** — "Active runtime authorization MUST use `session.user` fields (role, branchId, agentId)" (`packages/database/src/schema/rbac.ts`). Decisions read role + branch + agent off the session, scoped by tenant.

## Decision Drivers

- Org- and resource-scoped decisions (tenancy from ADR-001).
- Minimum-necessary access for PHI (HIPAA — report §9 Phase 3).
- Avoid a heavyweight external policy engine before it's justified.
- Testability and centralization (one place to reason about access).

## Options

1. **Extend RBAC.** Add a roles×permissions table, keep equality checks. Familiar; doesn't natively express resource/tenant scope or attribute conditions.
2. **Tenant-scoped ABAC, evaluated in-process.** Decisions are `allow(subject, action, resource, context)` where `context` carries `tenantId`, `branchId`, ownership, and resource attributes. Policies are code (pure, unit-testable) in a `platform-authz` package. No external engine.
3. **External policy engine (OPA/Cedar/OpenFGA).** Powerful, decoupled; operational overhead and latency; premature for current scale.

## Decision (recommended)

**Option 2: tenant-scoped ABAC in a `platform-authz` package**, with session-claim fast-paths borrowed from Interdomestik. Extract the existing `domain-identity` policies into `platform-authz`; express decisions as pure functions over `(subject, action, resource, context)`. Carry `tenantId`/`branchId`/`role`/ownership on the resolved session (ADR-002) so the common case is a cheap claim check, escalating to attribute evaluation (e.g., "is this nurse assigned to this request?") only when needed. Roles become named **policy bundles** per org. Defer an external engine (Option 3) unless cross-service authorization or customer-authored policies appear.

Rationale: ABAC is the minimum model that expresses tenant + resource + minimum-necessary PHI constraints. Keeping it in-process (pure functions) preserves the codebase's strong unit-test culture and avoids OPA's operational tax. Extending flat RBAC (Option 1) would not meet the PHI minimum-necessary requirement cleanly.

## Consequences

**Positive:** expresses org/branch/resource scope and minimum-necessary access; centralized, unit-testable; no new infra; integrates with RLS (defense in depth — authz in app, isolation in DB).

**Negative / costs:** must thread `context` (tenant, ownership) into every decision; policy bundles need governance; risk of policy/RLS drift (mitigate by testing both against the same scenarios).

## Verification

- Policy unit tests per `(role, action, resource, tenant)` matrix, including deny cases and cross-tenant deny.
- Integration test: an API route denies a cross-tenant/cross-branch action even if RLS were disabled (and RLS denies it even if the policy were wrong) — both layers independently enforce.
- PHI minimum-necessary test: a role sees only permitted fields.

## Open items

- Where role↔policy-bundle mappings live (DB-config vs code) and who edits them (tenant admin UI is Phase 4).
- Whether `patient` and `referral_partner` become org-scoped or stay global personas.
