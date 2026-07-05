# NC-E2-04 Medical Evidence Brand Design

Date: 2026-07-04
Status: Proposed
Slice: `NC-E2-04 / medical-evidence-brand`
Implementation branch: `codex/medical-evidence-brand`
Risk tier: Tier 2
Slice class: implementation design gate

## Purpose

Add proof-token guards for nurse credential status writes and clinical visit
summary writes. This is the next type-level hardening slice after
`NC-E2-03 / platform-authz`.

## Source Decisions

- `AGENTS.md` Mandate 3 forbids new raw string state writes outside owning
  domain transition functions.
- `NC-E2-03` established `Brand<T, Tag>`, module-private `WeakSet` runtime
  proof checks, and authorized update helpers for `service_requests.status`.
- `NC-E2-03` also established branded `PolicyDecision` and `OrganizationId`;
  credential evidence must compose with those tokens.
- `NC-E2-04` requires `MedicalEvidence` and `VerifiedCredentialEvidence` for
  `nurses.status` and clinical writes.
- Clinical/credential evidence is PHI-adjacent; logs and admin audit details
  must not include PHI values.

## Scope

- Add credential proof constructors in `packages/domain-nurse`.
- Require credential status writes through an authorized update helper.
- Add negative type tests proving raw nurse status objects do not satisfy the
  authorized update type.
- Extend architecture guard coverage for raw `nurses.status` writes.
- Add a small `MedicalEvidence` proof helper for future visit summary writes,
  with tests and exports, but do not add a new clinical route.
- Keep admin verification/reject/suspend API behavior unchanged.

## Non-Scope

- No schema, migration, RLS, tenant backfill, outbox, worker, or projection work.
- No new PHI storage, encryption, retention, read-audit, or vendor decision.
- No broad CQRS repair for existing quarantined joins in `domain-nurse` or
  `domain-visit`.
- No UI changes.
- No route-wide tenant-session migration. If existing admin routes cannot pass
  full membership context yet, this slice may use a narrow adapter that derives
  the default tenant server-side and passes a branded `PolicyDecision`.

## Credential Proof Contract

`packages/domain-nurse/src/credential-evidence.ts` should own:

- `VerifiedCredentialEvidence` as a branded, frozen proof payload.
- `canVerifyCredential(from, context)` for submitted/under_review/
  renewal_pending/suspended/expired to verified.
- `canRejectCredential(from, context)` for submitted/under_review/
  renewal_pending to rejected.
- `canSuspendCredential(from, context)` for verified/renewal_pending to
  suspended.
- `credentialStatusUpdate(evidence, expected, extras)` returning
  `AuthorizedNurseStatusUpdate`.

The constructor context must include a branded `OrganizationId`, the actor user
id, and a branded `PolicyDecision`; the constructor must call
`assertTenantActionAllowed` before minting evidence. The proof payload must bind
`organizationId`, `nurseId`, `actorUserId`, `fromStatus`, `toStatus`, and
`action`.

The update helper must reject persistence calls whose expected status, nurse id,
organization id, actor id, or action do not match the proof. It must not claim
one-time consumption unless it actually deletes its object from the module
`WeakSet`. Stale-proof protection is mandatory through compare-and-set.

Current schema note: `nurses` does not yet have `organization_id`; `NC-TB-01`
owns that migration. This slice binds organization in the proof and any
server-derived authz context, but it cannot add a tenant column or RLS predicate.

## Clinical Proof Contract

`packages/domain-visit/src/medical-evidence.ts` should own:

- `MedicalEvidence` as a branded, frozen proof payload.
- a minimal constructor that requires `requestId`, `actorUserId`, `actorRole`,
  branded `organizationId`, branded `PolicyDecision`, and `purpose`.
- an assertion/export helper for later clinical write adapters.

This slice should not introduce a new visit summary write path. The goal is to
land the proof substrate and guardrails without expanding PHI behavior.

## Implementation Notes

- Split helpers so each new file stays under 150 lines.
- Convert current `verifyNurseCredential`, `rejectNurseCredential`, and
  `suspendNurseCredential` writes to use `credentialStatusUpdate`.
- Preserve existing admin behavior, but require constructors to derive proof
  context server-side; clients must not submit tenant or proof fields.
- Compare-and-set is mandatory: include current status in the update `where`
  clause and raise a credential conflict error if no row updates.
- Keep existing `recordAdminAction` calls in the same transaction and include
  non-PHI decision metadata only.
- Raw `nurses.status` writes are allowlisted only for:
  `packages/domain-nurse/src/nurse-record.ts` `draft` construction,
  `packages/domain-nurse/src/self-service.ts` `submitted` submission, and
  `packages/domain-nurse/src/credential-lifecycle.ts` `submitted` upsert.
  Guard tests must assert the allowlist is exactly this set.

## Threat Surface

- Forged structural proof object: mitigate with module-private `WeakSet` and
  JSON/spread forgery tests.
- Stale credential proof: mitigate with bound `fromStatus` plus CAS update.
- Cross-tenant proof laundering: mitigate by binding branded `OrganizationId`
  and platform-authz `PolicyDecision`; full DB predicate waits for `NC-TB-01`.
- PHI leakage: proof/audit details carry ids, statuses, action, and dates only;
  no license number, patient address, care notes, or clinical text in logs.
- Scope creep: clinical proof substrate lands without a new clinical write.

## Rollback

No schema, migration, RLS, or client-contract changes are planned. Rollback is a
straight revert of `codex/medical-evidence-brand`; admin credential APIs keep
their existing request/response behavior.

## Falsifiable Exit Criteria

- `pnpm --filter @nurseconnect/domain-nurse test` passes.
- `pnpm --filter @nurseconnect/domain-visit test` passes.
- `pnpm test:api` still passes admin nurse credential E2E coverage.
- `pnpm architecture:boundaries` fails on synthetic raw `nurses.status` writes
  and passes on `credentialStatusUpdate`.
- Type-check fails for raw `AuthorizedNurseStatusUpdate` construction outside
  `domain-nurse`.
- Type-check fails for raw `MedicalEvidence` construction outside
  `domain-visit`.
- Tests prove stale credential proof yields credential conflict, and proof for
  nurse A cannot update nurse B.
- `pnpm verify-slice -- --required-gates` passes before PR.

## Review Questions

- Should rejected/suspended transitions allow every current legacy state, or
  only the explicit subset above?
- Should `licenseValidUntil` be included in the proof payload or only in the
  authorized update extras?
- Should `MedicalEvidence` live in `domain-visit` now, or in contracts for
  later cross-domain use after NC-E5 defines PHI data classification?
