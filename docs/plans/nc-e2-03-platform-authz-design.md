# NC-E2-03 Platform AuthZ Design

Date: 2026-06-05
Status: Proposed
Slice: `NC-E2-03 / platform-authz`
Implementation branch: `codex/platform-authz`
Design branch: `codex/platform-authz-design`
Risk tier: Tier 3
Slice class: implementation design gate

## Purpose

Design the smallest implementation slice that adds tenant/resource-aware
authorization policy functions after `NC-E2-02 / tenant-memberships`.

This is a design packet only. It does not add runtime code, tests, routes,
schema, migrations, PHI behavior, session-tenant selection, or product behavior.

## Source Decisions

- ADR-001 defines `organization_id` as the shared-schema RLS tenant boundary.
- ADR-001 defines branch/facility/location as resource scope under the
  organization tenant boundary, while jurisdiction remains an operating and
  compliance scope rather than the tenant boundary.
- ADR-001 keeps nurse supply platform-level only for non-PHI routing identity;
  tenant-specific nurse eligibility, credentialing, consent, assignment
  participation, visit access, and audit evidence stay tenant/facility/
  jurisdiction-scoped.
- ADR-002 requires authorization to resolve current identity through the domain
  user projection, not Better-Auth tables directly.
- ADR-003 recommends in-process tenant-scoped ABAC through pure policy
  functions over subject, action, resource, and context.
- `NC-E2-01` centralized current-user resolution.
- `NC-E2-02` added organizations, fail-closed `org_memberships` RLS, and
  tenant-scoped membership helpers.

## Why This Slice Is Next

The repo now has the minimum concrete membership boundary needed to evaluate a
tenant-aware policy decision without guessing tenant shape. The next safe step
is to encode the authorization decision model as pure code and a policy matrix
before any route, PHI surface, or tenant-owned care-data table starts relying on
it.

## Scope For The Implementation Slice

The implementation slice should add a narrow platform authorization boundary:

- a new `@nurseconnect/platform-authz` workspace package, unless reviewers find
  a lower-risk existing package placement;
- typed policy inputs for:
  - subject identity: domain user id, legacy persona role, active organization
    membership role, and optional branch/facility scope ids;
  - resource descriptor: resource kind, owning organization id, optional
    branch/facility id, ownership fields, and PHI field classification;
  - action: a small initial action union covering tenant administration,
    tenant resource read/write, assignment participation, and PHI field read;
  - decision context: tenant id, jurisdiction marker when already known,
    and safe request metadata needed for deterministic policy tests;
- pure `authorizeTenantAction(...)` and `assertTenantActionAllowed(...)`
  functions that return structured allow/deny decisions and stable deny
  reasons;
- deny reason codes that are safe for internal logs and PR evidence but do not
  contain PHI, patient names, addresses, clinical notes, or raw resource
  identifiers;
- role-to-policy-bundle mapping for existing membership roles:
  `owner`, `admin`, `coordinator`, `requester`, and `viewer`;
- explicit fail-closed behavior for missing subject, missing membership,
  inactive membership, missing tenant context, cross-tenant resource, wrong
  branch/facility scope, and PHI field access;
- unit tests for a policy matrix that covers allow, deny, cross-tenant,
  inactive membership, wrong role, wrong resource owner, and PHI
  minimum-necessary cases;
- package exports and focused type-check/test wiring so downstream routes can
  adopt the policy boundary in later slices.

## Explicit Non-Scope

- No route rewiring from `requireRole(...)` or `requireAnyRole(...)`.
- No replacement or removal of the existing global `users.role` checks.
- No active-organization session claim, cookie, URL tenant selector, or tenant
  discovery API.
- No broad membership lookup outside an explicit tenant context.
- No database queries inside `@nurseconnect/platform-authz`; policy functions
  receive already-resolved, minimized inputs.
- No trust in client-provided resource ownership, PHI fields, branch/facility
  ids, or jurisdiction markers. Later route adapters must derive resource
  descriptors server-side from authoritative data.
- No schema, migration, RLS policy, trigger, seed, or backfill changes.
- No tenant ownership columns on request, patient, assignment, visit, audit,
  payment, payout, notification, or CRM tables.
- No branch/facility/location schema or membership model.
- No jurisdiction configuration table, regional routing, data-residency
  topology, notification vendor, BAA/DPA, retention, encryption, or PHI read
  audit implementation.
- No UI, product workflow, invite flow, SSO, SCIM, MFA, or tenant admin console.
- No external policy engine such as OPA, Cedar, or OpenFGA.
- No model/AI behavior.

## Proposed Package Contract

Create `packages/platform-authz` with the same workspace conventions used by
other packages:

- `package.json`
- `tsconfig.json`
- `vitest.config.ts`
- `src/index.ts`
- `src/types.ts`
- `src/actions.ts`
- `src/decision.ts`
- `src/policy.ts`
- `src/policy.test.ts`

The package must remain dependency-light. It should not depend on `apps/web`,
database clients, Better-Auth, React, Next.js, or domain packages that would
create cyclic policy ownership. If shared role unions are needed, import the
smallest stable type source or duplicate as a transitional type with a TODO
linked to the next adoption slice.

## Policy Input Model

The implementation should make policy inputs explicit and serializable enough
for tests and future audit evidence:

```ts
type TenantSubject = {
  userId: string;
  personaRole: "admin" | "nurse" | "patient" | "referral_partner";
  organizationId: string;
  membershipRole: "owner" | "admin" | "coordinator" | "requester" | "viewer";
  membershipStatus: "active";
  branchIds?: string[];
  facilityIds?: string[];
};

type TenantResource = {
  kind:
    | "organization"
    | "membership"
    | "request"
    | "assignment"
    | "visit"
    | "patient_record"
    | "nurse_context";
  organizationId: string;
  branchId?: string | null;
  facilityId?: string | null;
  ownerUserId?: string | null;
  assignedNurseUserId?: string | null;
  phiFields?: readonly string[];
};

type TenantAction =
  | "tenant.manage_members"
  | "tenant.read"
  | "tenant.write"
  | "request.create"
  | "request.read"
  | "request.update"
  | "assignment.participate"
  | "phi.read_field";
```

The exact names can change during implementation, but the final contract must
stay small enough that the policy matrix remains reviewable.

## Decision Behavior

Policy evaluation must be fail-closed:

- missing subject denies with `missing_subject`;
- non-active membership denies with `inactive_membership`;
- subject and resource organization mismatch denies with `cross_tenant`;
- missing resource organization denies with `missing_tenant`;
- branch/facility-restricted subjects deny resources outside their allowed
  scope;
- an empty branch/facility scope list means no scoped resource access; an
  omitted scope list means the role is not branch/facility-restricted for this
  slice;
- `viewer` can read non-PHI tenant/resource metadata but cannot mutate;
- `requester` can create/read request-scoped resources for the tenant but
  cannot manage members or read unrestricted PHI;
- `coordinator` can coordinate tenant demand and assignment workflow, but
  cannot manage tenant owners or read PHI fields that are not required for the
  action;
- tenant `admin` can manage tenant operations but cannot bypass explicit PHI
  minimum-necessary checks;
- `owner` can manage tenant membership and tenant administration, but PHI field
  access still requires explicit action/resource allowance;
- legacy global `admin` alone must not grant tenant access without active
  organization membership.

The decision result should be structured:

```ts
type AuthorizationDecision =
  | { allowed: true }
  | { allowed: false; reason: AuthorizationDenyReason };
```

`assertTenantActionAllowed(...)` may throw a package-owned error for app adapter
use later, but `authorizeTenantAction(...)` must remain pure and return the
decision object for matrix tests.

Deny precedence should be deterministic so tests and later adapters do not
accidentally leak sensitive resource facts:

1. missing subject or inactive membership;
2. missing tenant/resource organization;
3. cross-tenant mismatch;
4. branch/facility scope mismatch;
5. action/role denial;
6. PHI field denial.

Later app adapters can translate deny reasons to HTTP status codes and
user-facing copy. This package should not define HTTP responses.

## PHI Minimum-Necessary Groundwork

This slice should not implement PHI read audit or encryption. It should only
establish that policy decisions can express field-level PHI denial.

Required test examples:

- `viewer` reading a non-PHI request summary is allowed when tenant matches.
- `viewer` reading `patient_record.address` is denied.
- `coordinator` can read scheduling fields needed for assignment coordination
  but cannot read unrestricted clinical note fields.
- `owner` cannot bypass PHI field denial solely by tenant ownership.
- cross-tenant PHI field read denies before role-specific evaluation.

Use synthetic field names in tests. Do not introduce patient-identifying sample
data.

## Branch, Facility, And Jurisdiction Handling

The implementation must reserve policy inputs for branch/facility and
jurisdiction but should not create those schemas.

Rules for this slice:

- branch/facility ids are optional resource attributes;
- if a subject declares branch/facility scope, a scoped resource outside that
  list denies;
- if no branch/facility schema exists, tests use synthetic ids only;
- jurisdiction is a context marker for future slices and must not authorize
  cross-country or data-residency behavior yet;
- multi-country production behavior remains blocked until the program closes
  the regional/data-residency topology and concrete jurisdiction policy shape.

## Integration Contract For Later Slices

Future adoption slices can adapt route-level authorization by:

1. resolving current user through `resolveCurrentSessionUser()`;
2. requiring explicit active organization membership through the
   `NC-E2-02` helpers under `withTenantContext(...)`;
3. building a minimized `TenantSubject`;
4. loading or deriving a minimized `TenantResource`;
5. calling `authorizeTenantAction(...)`;
6. enforcing RLS independently for tenant-owned rows.

`NC-E2-03` should not perform steps 1 through 5 in app routes. It should only
make the policy call possible and tested.

Resource descriptors used by later adapters must be built from server-side
queries or trusted domain projections. Do not allow the client to declare the
resource's organization, facility, owner, assignment, jurisdiction, or PHI field
classification.

## Tests And Verification

Focused local checks for implementation:

- `pnpm --filter @nurseconnect/platform-authz test`
- `pnpm --filter @nurseconnect/platform-authz type-check`
- existing affected package tests if package exports touch shared type sources
- `pnpm verify-slice`
- `pnpm verify-slice -- --run-root <run_root> --static`
- reviewer pool from `<run_root>/reviewer-plan.md`
- `pnpm verify-slice -- --run-root <run_root> --required-gates`

Policy matrix minimum:

| Case | Expected |
|---|---|
| owner manages tenant members in same organization | allow |
| admin manages tenant operations in same organization | allow |
| coordinator updates assignment workflow in same organization | allow |
| viewer reads non-PHI metadata in same organization | allow |
| missing subject | deny |
| inactive membership | deny |
| global admin without membership | deny |
| same user, different organization resource | deny |
| requester tries to manage members | deny |
| viewer tries to mutate resource | deny |
| scoped subject accesses different branch/facility | deny |
| cross-tenant PHI read | deny |
| owner reads disallowed PHI field by ownership alone | deny |
| empty branch/facility scope reads scoped resource | deny |
| client-style resource descriptor is not used by package tests | no trusted-client pattern introduced |

## Reviewer Matrix

| Reviewer | Focus | Required For This Slice |
|---|---|---|
| Codex | repo fit, package placement, implementation coherence | yes |
| Claude/Sonnet | architecture, authz semantics, tenant/PHI risk | yes when callable |
| Gemini | product/workflow critique for on-demand staffing and multi-country assumptions | yes when callable |
| Copilot | implementation-risk and PR-review style critique | yes when callable |
| Security reviewer | authz bypass, tenant isolation, PHI minimum-necessary | yes |
| Architecture reviewer | package boundary and ADR alignment | yes |
| QA reviewer | policy matrix completeness and negative cases | yes |
| Ops reviewer | rollout, evidence, rollback, gate expectations | yes |

## Acceptance Criteria

The implementation slice is acceptable only when:

- `@nurseconnect/platform-authz` exports pure tenant/resource-aware policy
  functions and typed decisions.
- The policy matrix includes allow and deny cases for role, tenant, resource,
  branch/facility, inactive membership, missing subject, and PHI fields.
- Legacy global persona role alone cannot authorize tenant access.
- Policy decisions do not query the database and do not depend on app runtime
  state.
- Deny reason tests prove deterministic precedence and no PHI-bearing reason
  payloads.
- Branch/facility scope tests distinguish omitted scope from an empty denied
  scope.
- The design-review disposition records any unavailable reviewer routes and the
  implementation PR does not claim those blocked routes as approval.
- No route, schema, RLS, PHI read behavior, notification, or product workflow is
  changed.
- Local focused checks, `verify-slice` static gates, required gates, reviewer
  disposition, CI, Sonar, GitGuardian, and PR Finalizer pass.

## Rollback Or Mitigation

Because the slice should add only unused pure policy code and tests, rollback is
straightforward: revert the package and workspace metadata changes. Later route
adoption slices must remain separate so a policy-package rollback does not
revert product behavior or schema state.

## Design Review Evidence

Design review should run before implementation:

- packet: `docs/plans/nc-e2-03-platform-authz-design.md`
- run root: `tmp/multi-agent/design-review/nc-e2-03-platform-authz`
- debate: `tmp/multi-agent/design-review/nc-e2-03-platform-authz/reviews/debate.md`
- disposition: `docs/reviews/nc-e2-03-platform-authz-design-review.md`

## Open Questions For Reviewers

- Should `platform-authz` be a new package now, or should the first policy
  helpers live under `domain-identity` until route adoption proves the package
  split is worth the dependency surface?
- Is the initial action union too broad for one implementation slice?
- Which PHI field examples should be tested as synthetic placeholders without
  accidentally defining the future PHI inventory?
- Should deny reasons be public adapter-safe codes, internal-only codes, or both
  with a translation layer in app routes later?
