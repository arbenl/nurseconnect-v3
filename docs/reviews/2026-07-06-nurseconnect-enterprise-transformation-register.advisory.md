---
plan_role: input
status: draft
source_of_truth: false
provenance: model_generated_untrusted
model: claude-fable-5
date: 2026-07-06
expires: 2026-08-05
project: nurseconnect-v3
artifact_type: nc_ent_advisory_register
---

# NurseConnect Enterprise Transformation Register - Advisory

> Advisory register only. This document does not promote implementation work,
> authorize runtime changes, approve launch, or override NurseConnect repo
> authority. Runtime rows marked `CA+DG` require current-authority resolution,
> design gate, normal slice workflow, `verify-slice`, reviewer disposition, PR
> evidence, and closeout. The only currently promoted runtime slice remains
> `NC-TB-01 / codex/tenant-expand`.

## Register Rules

Status values: `not_started`, `in_progress`, `blocked(id)`,
`done(evidence path/PR)`, `dropped(reason)`.

Gate values:

- `none`: docs, ops, policy, or human evidence work only.
- `CA+DG`: runtime/source/schema/config behavior; cannot start from this file.
- `external`: legal, clinical, finance, reviewer, or third-party evidence.

Namespace:

- `NC-ENT-0xx`: privacy, tenant, PHI.
- `NC-ENT-1xx`: credential, dispatch, clinical.
- `NC-ENT-2xx`: payments, commercial.
- `NC-ENT-3xx`: operations, release, UX, enterprise readiness.

## Phase A - Now To 30 Days

Docs/ops/human evidence work that can proceed if accepted by intake and if it
does not displace `NC-TB-01`.

| ID | Work item | Owner | Status | Dependency | Evidence target | Gate | Blocking risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `NC-ENT-001` | PHI/PII/operational/derived classification manifest with retention notes | platform + privacy | `not_started` | none | `docs/security/phi-classification.md` or successor advisory path | `none` | NC-E5 work built blind |
| `NC-ENT-003` | Backfill/default-org membership verification attached to `NC-TB-01` closeout | platform + human reviewer | `not_started` | `NC-TB-01` | `NC-TB-01` evidence note proving membership set is correct | `CA+DG` | RLS can go green while isolation is false |
| `NC-ENT-005a` | Support and break-glass policy plus review cadence design | security + ops | `not_started` | none | support-access policy note | `none` | Standing privileged access without reason/review |
| `NC-ENT-006` | Jurisdiction memo and PHI vendor BAA/DPA inventory | privacy/legal | `not_started` | forcing question | counsel/DPO memo and vendor table | `external` | Unlawful PHI processing or unsellable enterprise posture |
| `NC-ENT-007` | Incident and breach response runbook set with notice clocks | ops + privacy | `not_started` | `NC-ENT-006` for clocks | severity matrix, breach runbook, notice templates | `none` | Breach response invented during incident |
| `NC-ENT-008a` | PHI/secret pattern scan for logs, fixtures, and model-bound evidence | security + platform | `not_started` | `NC-ENT-001` | scanner receipt and seeded failing fixture | `none` | Non-PHI invariant remains only convention |
| `NC-ENT-101` | Credential trust-chain spec and `VerifiedCredentialEvidence` minting-path review | credential reviewer + platform | `not_started` | none | primary-source verification procedure and minting review | `none` | Proof token proves code path but not real verification |
| `NC-ENT-104` | Dispatch state-machine spec: acceptance, cancellation, stale-open, no-show, escalation | clinical ops + platform | `not_started` | none | dispatch state-machine advisory spec | `none` | Double assignment or silent request expiry |
| `NC-ENT-106` | Clinical escalation boundary and "not an emergency service" policy | clinical ops + legal | `not_started` | none | signed policy and product-copy boundary | `external` | Emergency cases mishandled or overpromised |
| `NC-ENT-107a` | Visit-evidence provenance spec | clinical ops + platform | `not_started` | none | deterministic vs human-authored vs human-reviewed evidence spec | `none` | Visit evidence becomes untrustworthy in disputes |
| `NC-ENT-108a` | Geo/dispatch location classification and retention policy | privacy + clinical ops | `not_started` | `NC-ENT-001` | geo precision/retention memo | `none` | Location data retained or exposed without policy |
| `NC-ENT-201` | Money-model decision | finance + legal | `not_started` | none | signed payer/PSP/no-custody decision | `external` | Accidental money-transmission exposure |
| `NC-ENT-202` | Worker-classification and tax opinion intake | legal + finance | `not_started` | none | counsel opinion or intake memo | `external` | Misclassification liability |
| `NC-ENT-203a` | Ledger design: double-entry, append-only, outbox-sourced | finance + platform | `not_started` | `NC-ENT-201` | ledger design advisory doc | `none` | Payments cannot be reconstructed |
| `NC-ENT-204a` | Capture, payout, hold, clawback, and refund policy | finance + clinical ops | `not_started` | `NC-ENT-201`, `NC-ENT-107a` | signed policy matrix | `none` | Paying for unevidenced or disputed visits |
| `NC-ENT-207` | First-customer segment and "not selling yet" list | product + lead | `not_started` | none | pilot segment and scope memo | `none` | Commercial scope creep into unfunded risk |
| `NC-ENT-208` | Public/commercial claims register | product + compliance | `not_started` | none | claim to evidence table | `none` | Overclaiming "verified", "HIPAA", uptime, or emergency scope |
| `NC-ENT-301` | Release evidence-bundle template | release + platform | `not_started` | none | `docs/releases/` template or advisory template | `none` | Releases cannot be reconstructed |
| `NC-ENT-302` | Migration down-path CI rehearsal spec for `NC-TB-01` | platform + release | `not_started` | `NC-TB-01` | CI/down-path evidence in `NC-TB-01` PR | `none` | Reversible migration claim is unproven |
| `NC-ENT-303` | SLO catalog: dispatch, API, payments, outbox later | ops + platform | `not_started` | none | ratified SLO catalog | `none` | Degradation discovered by users |
| `NC-ENT-306` | Degraded-mode decisions for payments-down and geo-down | ops + finance + clinical | `not_started` | none | decision memos | `none` | Engineers improvise during outage |
| `NC-ENT-312` | On-call reality document | ops | `not_started` | none | owner/coverage/escalation memo | `none` | Enterprise-incredible operations story |

## Phase B - 31 To 60 Days

Mostly post-tenant-backfill runtime hardening and evidence consolidation.

| ID | Work item | Owner | Status | Dependency | Evidence target | Gate | Blocking risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `NC-ENT-002` | RLS fail-closed enforcement on domain tables and DB-layer abuse tests | platform + database | `not_started` | `NC-TB-01`, `NC-ENT-003` | slice closeout with DB abuse evidence | `CA+DG` | One authz bug exposes all tenant data |
| `NC-ENT-004` | PHI read-audit layer and no-PHI-read-outside-wrapper guard | platform + security | `not_started` | `NC-ENT-001`, `NC-ENT-002` | read-audit tests and guard receipt | `CA+DG` | Insider PHI reads invisible |
| `NC-ENT-005b` | `SupportAccessGrant` proof token and alarmed break-glass path | platform + security | `not_started` | `NC-ENT-005a`, `NC-ENT-004` | token tests and first review artifact | `CA+DG` | Privileged access remains standing |
| `NC-ENT-008b` | Typed non-PHI boundary for notification payloads | platform | `not_started` | `NC-ENT-001` | branded payload type and negative tests | `CA+DG` | PHI leaks through side channels |
| `NC-ENT-009` | Route policy-coverage assertion gate | platform + security | `not_started` | none | coverage gate output | `CA+DG` | IDOR on unwrapped handlers |
| `NC-ENT-010` | Tenant-safety assertions on quarantined joins before CQRS repair | platform + database | `not_started` | `NC-ENT-002` | interim tests and connection-reuse abuse evidence | `CA+DG` | Legacy joins become RLS bypass or p95 risk |
| `NC-ENT-205` | Cancellation, no-show, refund, and dispute SOP | finance + clinical + legal | `not_started` | `NC-ENT-104` | signed matrix | `none` | Every failed visit becomes ad hoc dispute |
| `NC-ENT-206` | Unit-economics metric spec | product + finance | `not_started` | `NC-ENT-104`, `NC-ENT-203a` | metric spec | `none` | Commercial learning cannot be trusted |
| `NC-ENT-304` | Alerting wiring and tested paging path | ops + platform | `not_started` | `NC-ENT-303` | alert-fire drill note | `CA+DG` | SLOs are decorative |
| `NC-ENT-305` | Rollback runbook and staging rehearsal | release + platform | `not_started` | staging target | dated rehearsal | `none` | First rollback happens live |
| `NC-ENT-307` | Procurement pack: controls, subprocessors, data-flow diagram | product + security + privacy | `not_started` | `NC-ENT-001`, `NC-ENT-006` | procurement folder | `none` | Enterprise deals stall in security review |
| `NC-ENT-308` | Game-day drills: rollback and breach tabletop | ops + privacy + release | `not_started` | `NC-ENT-007`, `NC-ENT-305` | drill notes | `none` | Runbooks remain untested |
| `NC-ENT-309a` | UI trust copy/design pass | product + clinical + legal | `not_started` | `NC-ENT-101`, `NC-ENT-106` | reviewed copy/design notes | `none` | Trust signals overpromise reality |

## Phase C - 61 To 90 Days

Runtime work that should align with outbox and later promoted slices.

| ID | Work item | Owner | Status | Dependency | Evidence target | Gate | Blocking risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `NC-ENT-102` | Suspension/expiry to dispatch ineligibility and eligibility snapshot at assignment | platform + credential reviewer | `not_started` | `NC-ENT-101`, `NC-ENT-002` | revocation-latency and assignment-snapshot tests | `CA+DG` | Ineligible nurse reaches patient |
| `NC-ENT-105` | Dispatch runtime hardening and availability side effects as outbox consumers | platform + clinical ops | `not_started` | `NC-ENT-104`, `NC-E3` | concurrency tests and closeout | `CA+DG` | Mandate-1 rework if built inline |
| `NC-ENT-107b` | Visit-evidence provenance guards | platform + clinical ops | `not_started` | `NC-ENT-107a` | append-only and review-before-consequence tests | `CA+DG` | Visit disputes unadjudicable |
| `NC-ENT-203b` | Runtime ledger from outbox-sourced payment events | platform + finance | `not_started` | `NC-ENT-203a`, `NC-E3` | reconciliation run evidence | `CA+DG` | Unreconcilable money movement |
| `NC-ENT-204b` | Runtime capture, payout, hold, clawback, and refund workflows | platform + finance | `not_started` | `NC-ENT-204a`, `NC-E3` | PSP/reconciliation evidence | `CA+DG` | Payment behavior outruns policy |
| `NC-ENT-309b` | Runtime UI trust implementation | product + platform | `not_started` | `NC-ENT-309a` | slice closeout | `CA+DG` | UI claims not backed by evidence |
| `NC-ENT-310` | Outbox lag/DLQ SLO and alerting with NC-E3 | ops + platform | `not_started` | `NC-E3`, `NC-ENT-303` | outbox observability proof | `CA+DG` | Silent notification or workflow loss |
| `NC-ENT-012a` | DR restore drill with timed RTO/RPO | ops + platform | `not_started` | DR baseline | dated restore drill | `none` | Restore posture remains theoretical |

## Phase D - 90 To 180 Days

Enterprise-claims band. Do not schedule before earlier gates and evidence land.

| ID | Work item | Owner | Status | Dependency | Evidence target | Gate | Blocking risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `NC-ENT-011` | Field encryption, key custody, then crypto-shred erasure | platform + privacy/security | `not_started` | `NC-ENT-001`, NC-E5 authority | custody doc and shred demo | `CA+DG` | No erasure or crypto claims |
| `NC-ENT-012b` | Tamper-evident per-tenant audit export | platform + security | `not_started` | NC-E3/NC-E5 | sanitized export sample | `CA+DG` | Audit requests unanswerable |
| `NC-ENT-103` | Credential re-verification cadence jobs and expiry automation | platform + credential reviewer | `not_started` | `NC-ENT-101`, NC-E3 | scheduled-job evidence | `CA+DG` | Credential trust decays silently |
| `NC-ENT-108b` | Runtime geo/dispatch handling under classification policy | platform + privacy | `not_started` | `NC-ENT-108a`, NC-E5 | slice closeout | `CA+DG` | Indefensible location data |
| `NC-ENT-311` | External pen test after tenant enforcement | external + security | `not_started` | `NC-ENT-002`, `NC-ENT-009`, `NC-ENT-010` | pen test report and remediation register | `external` | Paying for a report on known WIP |
| `NC-ENT-313` | SOC2-style evidence program and machine-checkable threat-model gate | security + platform | `not_started` | `NC-ENT-307` | control evidence calendar | `none` / `CA+DG` | Enterprise trust unscalable |
| `NC-ENT-314` | Maturity backlog: anomaly detection, MFA/dual-control, BYOK, WCAG external audit | mixed | `not_started` | various | per-item evidence | mixed | Maturity, not launch blocking |

## Maintenance Rules

1. Runtime rows never self-promote.
2. `done` requires evidence path or PR, not assertion.
3. Advisory findings expire on 2026-08-05 unless reverified against current
   trackers and source state.
4. Stop conditions override target dates.
5. `docs/plans/*` adoption requires a separate, reviewed authority change.
