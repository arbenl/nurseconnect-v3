---
plan_role: input
status: draft
source_of_truth: false
provenance: model_generated_untrusted
model: claude-fable-5
date: 2026-07-06
expires: 2026-08-05
project: nurseconnect-v3
artifact_type: fable5_enterprise_audit_intake
---

# NurseConnect Fable 5 Enterprise Audit Intake

> Advisory intake only. This document does not promote a slice, authorize
> runtime work, approve launch, or override `docs/plans/current-program.md`,
> `docs/plans/current-tracker.md`, `docs/plans/ENTERPRISE_UPGRADE_TRACKER.md`,
> `AGENTS.md`, tests, gates, or PHI rules. The only currently promoted runtime
> slice remains `NC-TB-01 / codex/tenant-expand`.

## Purpose

This note converts the 2026-07-06 Fable 5 enterprise audit into human-reviewed
repo evidence. Fable output is untrusted advisory input. A finding becomes
usable only after Arben or a named reviewer marks it `accepted`,
`rejected(reason)`, or `needs_evidence(path)`.

Only `accepted` findings may become rows in the advisory `NC-ENT-*` register.
The register is still not current authority unless later adopted through the
NurseConnect authority chain.

## Evidence Base

Fable run root:

```text
tmp/multi-agent/fable5-enterprise-audit/2026-07-06-direct
```

Inputs and outputs:

| Artifact | Path |
| --- | --- |
| Sanitized context | `tmp/multi-agent/fable5-enterprise-audit/2026-07-06-direct/sanitized-context.md` |
| Pass 1 PHI/tenant/auth | `tmp/multi-agent/fable5-enterprise-audit/2026-07-06-direct/pass-1-phi-tenant-auth.output.md` |
| Pass 2 credential/dispatch/commercial | `tmp/multi-agent/fable5-enterprise-audit/2026-07-06-direct/pass-2-credential-dispatch-commercial.output.md` |
| Pass 3 ops/performance/UX | `tmp/multi-agent/fable5-enterprise-audit/2026-07-06-direct/pass-3-ops-performance-ux-enterprise.output.md` |
| Pass 4 cleaned synthesis | `tmp/multi-agent/fable5-enterprise-audit/2026-07-06-direct/pass-4-synthesis.cleaned.md` |

Privacy boundary: no PHI, secrets, credentials, raw logs, production exports,
provider console URLs, patient data, nurse identifiers, facility identifiers,
payment identifiers, or production account identifiers may be added to this
intake.

## Forcing Questions

These two answers change the severity of every downstream row.

| Question | Current answer | Required evidence | Disposition |
| --- | --- | --- | --- |
| Does any environment contain real patient PHI today? | `needs_evidence` | Dated human answer plus sanitized environment/data-class summary | `needs_evidence` |
| Which legal/privacy regime governs the first commercial path? | `needs_evidence` | Counsel/DPO memo covering HIPAA, GDPR/local health law, BAA/DPA obligations, breach notice clocks, and jurisdiction assumptions | `needs_evidence` |

If real PHI exists today, Phase A privacy and incident rows become remediation,
not future planning.

## Disposition Vocabulary

| Value | Meaning |
| --- | --- |
| `accepted` | Finding is accepted into the advisory register or week-1 packet. |
| `rejected(reason)` | Finding is rejected with a concrete reason and evidence path. |
| `needs_evidence(path)` | Finding is plausible but cannot be accepted until the named evidence exists. |
| `needs_owner` | Finding needs a named human owner before it can be acted on. |
| `needs_reverification` | Finding is stale or affected by later repo changes. |

## Intake Table

| Finding | Fable summary | Proposed rows | Initial disposition | Required human evidence |
| --- | --- | --- | --- | --- |
| Tenant isolation is not a data-plane property until tenant backfill and RLS enforcement land. | Route policy is currently the main wall; `NC-TB-01` must not be mistaken for full tenant isolation. | `NC-ENT-002`, `NC-ENT-003` | `needs_evidence` | `NC-TB-01` closeout, membership verification, DB-layer abuse evidence |
| PHI classification is missing. | Audit, encryption, redaction, retention, and model boundaries cannot be proven without a manifest. | `NC-ENT-001` | `accepted` | Human-reviewed PHI/PII/operational/derived manifest draft |
| PHI read audit is missing. | Accounting of disclosures and insider abuse detection are impossible without read audit. | `NC-ENT-004` | `needs_evidence` | PHI-bearing resource list and current read-surface inventory |
| Support and break-glass access are ungoverned. | Healthcare support access needs reasoned, time-boxed, logged, reviewed grants. | `NC-ENT-005a`, `NC-ENT-005b` | `accepted` | Current support-access answer and human policy signoff |
| Jurisdiction and BAA/DPA posture are unevidenced. | Legal/vendor boundary blocks commercial PHI handling independent of code quality. | `NC-ENT-006` | `accepted` | Counsel/DPO memo and vendor inventory |
| Breach and incident procedure is missing. | A breach clock should not start while the team invents the process. | `NC-ENT-007` | `accepted` | Severity matrix, notice templates, named owners |
| Credential trust chain is not yet human-verifiable. | `VerifiedCredentialEvidence` proves code path, not primary-source verification. | `NC-ENT-101`, `NC-ENT-102`, `NC-ENT-103` | `accepted` | Credential reviewer, primary-source procedure, minting-path review |
| Dispatch safety is underspecified. | Exactly-one-assignment, stale-open escalation, no-show, cancellation, and emergency refusal need explicit state rules. | `NC-ENT-104`, `NC-ENT-105`, `NC-ENT-106` | `accepted` | Clinical ops signoff and dispatch state-machine spec |
| Visit evidence provenance is unclear. | System facts, human-authored notes, and human-reviewed consequences need separate provenance. | `NC-ENT-107a`, `NC-ENT-107b` | `accepted` | Clinical ops review |
| Geo/dispatch data policy is missing. | Location can be operationally necessary and privacy sensitive; precision/retention must be decided. | `NC-ENT-108a`, `NC-ENT-108b` | `needs_evidence` | Data classification decision and retention memo |
| Money model and worker classification are undecided. | First paid visit can create money-transmission, tax, or classification exposure. | `NC-ENT-201`, `NC-ENT-202` | `accepted` | Finance/legal decision memo |
| Ledger, capture, payout, refund, and reconciliation model are missing. | Money must not move without reconcilable evidence. | `NC-ENT-203a`, `NC-ENT-203b`, `NC-ENT-204a`, `NC-ENT-204b`, `NC-ENT-205` | `accepted` | Finance owner and signed policy |
| Public/commercial claims need evidence mapping. | Claims like "verified nurses", "HIPAA", uptime, or emergency capability must fail closed. | `NC-ENT-208` | `accepted` | Current public-copy inventory |
| Release and operate-time evidence is thin. | SLOs, alerting, rollback, on-call, breach response, release bundles, and procurement evidence are mostly absent. | `NC-ENT-301` through `NC-ENT-314` | `accepted` | Release/ops owner names and first templates |

## Intake Decision

Initial recommendation: accept the advisory register shape, keep every row
`not_started`, and start only Phase A docs/ops/human evidence work that does
not alter runtime behavior and does not displace `NC-TB-01`.

Required next human action: answer the two forcing questions and assign owners
for `NC-ENT-001`, `NC-ENT-006`, `NC-ENT-007`, `NC-ENT-101`,
`NC-ENT-201`, `NC-ENT-202`, `NC-ENT-303`, and `NC-ENT-312`.
