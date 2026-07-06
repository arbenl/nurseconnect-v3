---
plan_role: input
status: draft
source_of_truth: false
provenance: model_generated_untrusted
model: claude-fable-5
date: 2026-07-06
expires: 2026-08-05
project: nurseconnect-v3
artifact_type: nc_ent_week1_packet
---

# NurseConnect Week 1 Enterprise Readiness Packet - Advisory

> Advisory week-1 packet only. This document authorizes no runtime work and
> changes no source behavior. It exists to organize docs, operations, and human
> evidence intake around the 2026-07-06 Fable 5 enterprise audit. The only
> currently promoted runtime slice remains `NC-TB-01 / codex/tenant-expand`.

## Week 1 Rule

```text
Verify first.
Sign off second.
Gate third.
Build fourth.
Expose last.
```

For NurseConnect, that means week 1 should create evidence and human decisions,
not new runtime behavior. Runtime rows marked `CA+DG` in the advisory register
must not start from this packet.

## Primary Outcomes

By the end of week 1, NurseConnect should have:

1. A completed human intake over the Fable findings.
2. Answers or named owners for the two forcing questions.
3. Owners for the first privacy, credential, money-model, ops, and release
   evidence rows.
4. A clear separation between work that may proceed now and runtime work that
   must wait for current authority.
5. No PHI, secrets, raw logs, production identifiers, or production evidence
   sent to external models.

## Immediate Docs/Ops Work

These items can be prepared without runtime/source behavior changes if Arben
accepts them in the intake note.

| Item | Register row | Owner needed | Output | Acceptance |
| --- | --- | --- | --- | --- |
| Human intake over Fable findings | intake | Arben | completed disposition table | every major finding is `accepted`, `rejected(reason)`, or `needs_evidence(path)` |
| PHI classification draft | `NC-ENT-001` | privacy/platform | classification table draft | patient/request/visit/nurse/payment/audit/log data classes are named |
| Jurisdiction and vendor legal intake | `NC-ENT-006` | legal/privacy | counsel/DPO question packet | first legal regime and BAA/DPA questions are explicit |
| Breach/incident runbook skeleton | `NC-ENT-007` | ops/privacy | severity matrix and notice-clock skeleton | owners and open legal questions are named |
| Support/break-glass policy draft | `NC-ENT-005a` | security/ops | access policy note | reason, duration, logging, review cadence are specified |
| Credential trust-chain spec | `NC-ENT-101` | credential reviewer | verification procedure draft | primary-source check, expiry, suspension, and minting authority are defined |
| Dispatch state-machine spec | `NC-ENT-104` | clinical ops/platform | advisory state diagram/table | accept, cancel, stale-open, no-show, emergency-refusal paths are listed |
| Clinical escalation boundary | `NC-ENT-106` | clinical/legal | policy and copy boundary | service is not positioned as emergency response |
| Money-model decision packet | `NC-ENT-201` | finance/legal | signed-decision worksheet | payer, PSP structure, custody boundary, and launch constraints are explicit |
| Worker-classification intake | `NC-ENT-202` | legal/finance | counsel question packet | worker classification assumptions are not guessed |
| Claims register seed | `NC-ENT-208` | product/compliance | claim to evidence table | current claims have evidence path or are marked blocked |
| Release evidence template | `NC-ENT-301` | release/platform | release-bundle template | gates, rollback, migration proof, PHI/log scan placeholders exist |
| Migration down-path CI spec | `NC-ENT-302` | platform/release | `NC-TB-01` companion checklist | reversible-migration proof is ready to ride with `NC-TB-01` |
| SLO catalog draft | `NC-ENT-303` | ops/platform | SLO document | dispatch/API/payment/outbox-later SLOs are ratified or marked provisional |
| Degraded-mode decisions | `NC-ENT-306` | ops/finance/clinical | decision memos | payments-down and geo-down behavior is not improvised |
| On-call reality doc | `NC-ENT-312` | ops | coverage/escalation memo | current support reality is documented honestly |

## Runtime Work That Must Not Start From This Packet

The following rows are runtime-gated. They require current-authority resolution,
design gate, normal slice workflow, required gates, review disposition, PR
evidence, and closeout.

```text
NC-ENT-002
NC-ENT-004
NC-ENT-005b
NC-ENT-008b
NC-ENT-009
NC-ENT-010
NC-ENT-102
NC-ENT-105
NC-ENT-107b
NC-ENT-203b
NC-ENT-204b
NC-ENT-304
NC-ENT-309b
NC-ENT-310
NC-ENT-011
NC-ENT-012b
NC-ENT-103
NC-ENT-108b
```

This packet also does not promote NC-E3, NC-CQ, or NC-E5 work ahead of the
current tracker.

## Human Reviewer Requests

| Reviewer | Request | Related rows |
| --- | --- | --- |
| Arben | Answer whether real patient PHI exists today and which legal/privacy regime governs first launch. | intake, `NC-ENT-006` |
| Privacy/security | Review PHI classification, vendor list, support access, breach runbook, backups, model boundaries. | `NC-ENT-001`, `005a`, `006`, `007`, `008a` |
| Credential reviewer | Define primary-source verification, registry evidence, expiry, suspension, appeal, and minting authority. | `NC-ENT-101`, `102`, `103` |
| Clinical ops | Review dispatch state machine, no-show, escalation, not-emergency boundary, visit evidence. | `NC-ENT-104`, `106`, `107a` |
| Finance/legal | Decide money model, PSP/custody boundary, worker classification, cancellation/refund rules. | `NC-ENT-201`, `202`, `203a`, `204a`, `205` |
| Release/ops | Draft release evidence bundle, SLOs, rollback, on-call, alerting, degraded-mode decisions. | `NC-ENT-301`, `302`, `303`, `305`, `306`, `312` |
| Product/UX | Seed claims register and review wording for verified nurses, emergency boundary, trust signals. | `NC-ENT-208`, `309a` |

## Stop Conditions

Stop and escalate if any of these occur:

- Real PHI is discovered in an environment before Phase A privacy evidence
  exists.
- Any cross-tenant exposure is suspected.
- `NC-TB-01` backfill membership evidence cannot prove default-org membership
  correctness.
- A path can mint `VerifiedCredentialEvidence` without backing verification
  evidence.
- Money moves without a ledger/reconciliation path.
- A gate is proposed to be relaxed so a slice can pass.
- Unsanitized PHI, secrets, identifiers, raw logs, or production evidence is
  proposed for an external model.

External model disclosure cannot be rolled back after sending. Prevention is
the only control.

## Week 1 Closeout Checklist

| Check | Status |
| --- | --- |
| Intake table completed | `not_started` |
| Two forcing questions answered or owner/date recorded | `not_started` |
| `NC-ENT-001`, `006`, `007`, `101`, `201`, `202`, `303`, `312` have named owners | `not_started` |
| `NC-TB-01` remains the only promoted runtime slice | `not_started` |
| No runtime behavior was changed from this packet | `not_started` |
| No unsanitized model payload was sent | `not_started` |
