# NC-E1-01 Tenant Model Debate Evidence

**Date:** 2026-06-04
**Slice:** `NC-E1-01 / tenant-model-decision`
**Packet:** `tmp/slice-design/NC-E1-01-tenant-model-decision.md`
**Run root:** `tmp/multi-agent/design-review/nc-e1-01-tenant-model-decision`

## Reviewer Routes

| Route | Status | Notes |
|---|---|---|
| `codex` | `blocked` | Local Codex CLI config rejected `service_tier = priority`; treated as missing advisory signal, not approval. |
| `claude` | `blocked` | Timed out after 120 seconds; treated as missing advisory signal, not approval. |
| `gemini` | `complete` | Recommended org plus branch/facility, with explicit data-residency and B2B/B2C constraints. |
| `copilot` | `complete` | Recommended org plus branch/facility from v1, with platform nurse vs tenant nurse data classification before schema work. |

## Findings Accepted Into ADR-001

- `MUST_FIX`: country/jurisdiction cannot be merely descriptive for multi-country production. ADR-001 now states jurisdiction is an operating/compliance scope and requires regional/data-residency topology review before multi-country production rollout.
- `MUST_FIX`: B2B/B2C ambiguity must not leave demand rows without a tenant owner. ADR-001 now states demand is tenant/facility scoped. Direct-to-consumer demand, if added later, needs an explicit tenant/contractual ownership model before implementation.
- `MUST_FIX`: platform-level nurse supply needs a hard PHI boundary. ADR-001 now limits platform-level nurse data to non-PHI routing identity and pushes eligibility, credentialing state, consent, assignment participation, visit access, and audit evidence into tenant/facility/jurisdiction-scoped context.
- `MUST_FIX`: legal jurisdiction needs an enforcement hook. ADR-001 now requires a jurisdiction configuration referenced by organizations/facilities and resolved before request, nurse eligibility, assignment, retention, and vendor-policy writes that create tenant-scoped care data.
- `MUST_FIX`: the legal/contractual customer boundary must be named. ADR-001 now states each organization maps to an explicit legal/contracting profile for BAA/DPA, billing, privacy, and audit ownership.
- `HARDENING`: branch/facility must be first-class from v1 because assignment ownership, audit, exports, and facility-scoped authorization depend on it. ADR-001 now closes Decision B as organization plus branch/facility/location.
- `HARDENING`: facility scope must have a minimum schema contract. ADR-001 now names organizations, facilities/branches with `organization_id`, and membership/authorization relationships such as `organization_facility_memberships`.
- `HARDENING`: audit ownership must be explicit. ADR-001 now binds tenant audit rows to the requesting organization/facility and reserves separate non-PHI platform audit for platform-level supply or marketplace events.

## Decision

Adopt organization plus branch/facility/location from v1:

- `organization` is the customer/contracting boundary and RLS tenant boundary.
- `branch`/`facility`/`location` is the resource scope for demand, assignments, visits, audit, exports, and branch-scoped authorization.
- nurse supply is platform-level only for non-PHI routing identity.
- tenant nurse eligibility/context carries tenant, facility, jurisdiction, credentialing, consent, assignment, visit, and audit boundaries.
- country/jurisdiction is a compliance and operating scope, not the tenant boundary.
- direct-to-consumer demand is not implicit v1 scope; if added later it needs an explicit organization-equivalent tenant/contractual ownership model before PHI rows are created.

## Remaining Risks

- NC-E1-02 must design the exact platform nurse vs tenant nurse data-classification table before schema work.
- Multi-country production deployment must not proceed without a regional/data-residency topology decision.
- Physical tenant isolation remains deferred, but the RLS mechanism should keep tenant-context boundaries explicit enough to allow future regional or physical isolation if required.
