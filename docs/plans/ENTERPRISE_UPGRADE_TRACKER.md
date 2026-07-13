---
plan_role: phase_c_enterprise_tracker
status: active
source_of_truth: false
authority_note: "current-program.md is the singular source of truth; this tracker defers to current-program.md and current-tracker.md only. It extends nurseconnect-enterprise-architecture-tracker.md, whose pre-Phase-C rows (e.g. the unamended NC-E2-03) are superseded by the amendments recorded here."
owner: platform
created: 2026-06-10
last_reviewed: 2026-06-10
program_path: docs/plans/nurseconnect-enterprise-architecture-program.md
current_tracker_bridge: docs/plans/current-tracker.md
verification_command: pnpm verify-slice
---

# NurseConnect Phase C Enterprise Upgrade Tracker

> **Goal:** bring NurseConnect V3 to the Interdomestik "Phase C Enterprise
> Standard": transactional outbox (no bare-row mutation side effects), CQRS
> boundaries (no cross-domain SQL joins), type-level guards (phantom types on
> core state mutations), and fail-closed `ent-tm` / `ent-dlv` / `ent-perf`
> verification gates wired into `verify-slice`.
>
> **Gate doctrine:** the ent-* gates are bolted onto the existing
> `pnpm verify-slice -- --required-gates` contract (NC-EG-01). They are
> **fail-closed**: a slice with no gate manifest fails; a PR opened without
> recorded ent-* evidence fails PR Finalizer. Never relax a gate threshold to
> make a slice pass — fix the slice or formally amend the gate in its own
> reviewed slice.

## Execution order

`NC-EG-00` (governing docs) → `NC-EG` → amended `NC-E2-03` → `NC-TB` → `NC-E3` → `NC-CQ` → `NC-E5`.
Gates land first so every subsequent slice is born under them. NC-CQ-02..04
depend on the outbox/read-model backbone (NC-E3) for event-fed projections.

## Band NC-EG — Enterprise Verification Gates (ent-tm / ent-dlv / ent-perf)

| ID | Status | Slice | Work | Acceptance Criteria (falsifiable) | Risk |
|---|---|---|---|---|---|
| `NC-EG-00` | `completed` | `constitution-deployment` | Land the Phase C governing docs: rewritten `AGENTS.md` (Four Mandates), `CLAUDE.md`, `GEMINI.md`, `HANDOVER.md`, `project_architecture.md`, this tracker, the `nurseconnect-execution-runner` SOP deployed identically to `.codex/`, `.claude/`, `.gemini/` skills, `ADR-005-slice-lifecycle-automation.md`, and the NC-EG-01 design doc. Docs **plus one disclosed gate amendment**: finalizer tracker-ID regex extended to the Phase C band namespace (`scripts/lib/pr-slice-evidence.mjs` + regression test). | PR #101 merged at `b2baa0a80572a2eb10471dcd02c1c945928fc0ef`; three SKILL.md copies are byte-identical; `current-program.md`/`current-tracker.md`/this tracker agree on next slice = NC-EG-01; docs-only verify-slice static + required gates passed with run root `tmp/multi-agent/verify-slice/verify-slice-20260612T214308Z-c2ad6b`; CI + PR Finalizer green. | Low |
| `NC-EG-01` | `completed` | `ent-gate-framework` | Add a fail-closed ent-gate stage to `verify-slice --required-gates` and PR Finalizer. Each slice declares a `slice-gates.yaml` manifest (`ent-tm`, `ent-dlv`, `ent-perf`: `required\|n/a + justification`). | PR #105 merged at `246b74e6f569cd20464f6ec82fce7d4bfae5c740`; PR #106 follow-up merged at `08fbced6a586353aa3884a1cfcf238bfa60bca96`; missing manifests, unjustified `n/a`, guarded-path `n/a`, and missing PR evidence fail closed. | Medium |
| `NC-EG-02` | `planned` | `ent-tm-gate` | Threat-model gate: any slice touching auth, tenancy, PHI surfaces, or money requires a STRIDE-lite threat model doc (`docs/threat-models/<slice>.md`) from a checked template; gate verifies existence + section completeness deterministically. | Slice diff touching guarded paths (path-classifier list) without a threat model fails the gate; template sections are machine-checked; first real threat model lands for NC-E2-03. | Medium |
| `NC-EG-03` | `planned` | `ent-dlv-gate` | Data-lifecycle gate: machine-readable PHI/data-class manifest (`packages/database/data-classification.json`). Gate diffs Drizzle schema vs manifest: every column must declare class (`phi\|pii\|operational`), retention, and erasure strategy (`crypto-shred\|delete\|retain-legal`). | Adding a schema column without a manifest entry fails CI; manifest entries with `phi` but no erasure strategy fail; baseline manifest covers all 16 existing schema files at merge. | High |
| `NC-EG-04` | `planned` | `ent-perf-gate` | Performance budget gate: `perf-budgets.json` (p95 latency per critical route: create-request, lifecycle actions, /api/me; bundle-size budget for `apps/web`). Gate asserts budgets in CI against a deterministic local benchmark lane. | Budget regression fails `--required-gates`; budgets file is required for slices touching critical routes; benchmark lane is reproducible (fixed seed/dataset). | Medium |
| `NC-EG-05` | `planned` | `lifecycle-three-planes` | Implement ADR-005 slice lifecycle automation. **Plane 1 (record):** GitHub Actions workflow on merged PRs derives closeout + `completed` status from `codex/<slice>` branch events; a bot identity is the ONLY writer of `completed` in both trackers + `current-program.md`; projection is re-runnable from git history. **Plane 2 (enforcement):** extend PR Finalizer with branch-name validation and promoted-slice matching (ent-gate evidence/sha pinning arrives via NC-EG-01). **Plane 3 (decision):** thin authority-free `start <id>` client exposed as an MCP tool (validate promotion, create branch, open promotion PR with decision provenance). **CODEOWNERS:** code-owner review required on `.github/workflows/**`, `scripts/multi-agent/**`, `scripts/ent-gates/**`, `config/ent-gate-paths.json`, `docs/plans/**`, and all three `*/skills/**` SOP paths. | ADR-005 verification suite: non-bot tracker-status edit fails finalizer; non-promoted branch merge produces no closeout + raises alert; projection replay over last N merges is byte-identical; CODEOWNERS blocks unreviewed gatekeeper edits (branch-protection evidence); plane-3 bypass loses nothing (PR from manual branch still fully gated). | Medium-High |

## Band NC-E2 (amendment) — Platform AuthZ + Type-Level Guards

| ID | Status | Slice | Work | Acceptance Criteria (falsifiable) | Risk |
|---|---|---|---|---|---|
| `NC-E2-03` | `completed` | `platform-authz` | **(Amended scope.)** In-process tenant/resource-aware policy functions **plus the phantom-type substrate**: `packages/contracts/src/brands.ts` with `Brand<T, Tag>` helper; `AuthorizedTransition` brand — `canTransition`/`canAdminTransition` become the only constructors of a branded transition token, and every `service_requests.status` write site requires it; policy functions return branded `PolicyDecision`, not booleans. | PR #109 merged at `945b09362a786c082a71f2e4fbd77a372c7df452`; policy matrix covers allow/deny/cross-tenant/PHI/action-resource cases; `tsc` fails on a direct `status` write without an `AuthorizedTransition`; guard blocks raw status writes; ent-tm threat model and required gates passed. | High |
| `NC-E2-04` | `completed` | `medical-evidence-brand` | `MedicalEvidence` brand for credential/clinical state: `nurses.status` transitions (draft→verified→suspended/expired) require a branded `VerifiedCredentialEvidence` token constructed only by `domain-nurse` verification functions; visit `summary` writes require `MedicalEvidence`-branded payloads. | PR #111 merged at `b79a345267249fe7d431c7026dd0a44d59be486f`; type tests prove raw credential/clinical writes fail outside constructors; admin verification flow, boundary guard, ent-gates, CI, Sonar, GitGuardian, PR Finalizer, E2E API, and UI smoke passed. | Medium-High |

## Band NC-TB — Tenant Backfill Execution (prerequisite for RLS over PHI)

Executes the already-merged plan in `docs/runbooks/default-tenant-backfill-plan.md`.

| ID | Status | Slice | Work | Acceptance Criteria (falsifiable) | Risk |
|---|---|---|---|---|---|
| `NC-TB-01` | `completed` | `tenant-expand` | Default org/branch bootstrap; add **nullable** `organization_id` (+ accepted care-site scope) to tenant-owned request, assignment, visit, payment, payout, and event tables; platform nurse/location/service-area, referral, audit, and identity surfaces remain deferred per data-lifecycle evidence. | PR #114 merged at `48eb6fab9bd83712245716998c0cdf9bd6bbe196`; reversible migrations, zero-NULL/default-tenant invariants, ownership constraints, forged-context regression, rollback rehearsal, required gates, remote checks, and reviewer/security disposition passed. | High |
| `NC-TB-02` | `ready` | `tenant-observe` | Observe-before-enforce: tenant-scope violation detection on all domain queries via `withTenantContext`/`withTenant` adoption; violation signal exported. | Harness `guard` mode runs in CI; violation count visible; exit criterion = signal at zero for the full E2E suite. | High |
| `NC-TB-03` | `planned` | `tenant-enforce` | Flip: `organization_id NOT NULL`, composite unique `(organization_id, id)` per FK-scoped table, **RLS enforcing** on domain tables with non-bypassing role asserted by `rls-role-assertion.ts`. | Tenant-isolation abuse tests (NC-E1-04 harness, `enforce` mode) prove tenant A cannot read tenant B on every domain table; rollback runbook tested. | High |

## Band NC-E3 — Transactional Outbox & Jobs (stop mutating bare rows)

Implements ADR-004 (flip ADR-004 to **Accepted** in NC-E3-02's PR).

| ID | Status | Slice | Work | Acceptance Criteria (falsifiable) | Risk |
|---|---|---|---|---|---|
| `NC-E3-01` | `planned` | `assignment-notification-safe` | Post-commit, non-PHI assignment notification (best-effort) — decoupled so nurses are notified before the outbox exists. | Send fires strictly after `db.transaction` commit; payload contains zero PHI (contract test); provider failure cannot roll back or delay allocation. | Medium |
| `NC-E3-02` | `planned` | `outbox-schema` | `packages/platform-events`: persisted `outbox_events` table (tenant_id, aggregate, type, payload, dedupe_key unique, status, attempts, next_available_at, locked_by/at) + port modeled on Interdomestik `CrmOutboxPort` (`appendEvent → enqueued\|duplicate`). Domain mutations append in the same transaction. | Atomicity tests: rolled-back tx leaves no outbox row; committed state change always enqueues; duplicate dedupe_key returns `duplicate`. ent-dlv manifest entries for the new table. | High |
| `NC-E3-03` | `planned` | `outbox-worker` | Claim/publish/fail/dead-letter worker: `FOR UPDATE SKIP LOCKED` claim, idempotent consumers, exponential `next_available_at` backoff, dead-letter after N attempts. Runtime decision (Vercel cron vs dedicated worker) recorded as ADR-004 addendum. | Replay test: re-delivering an event produces no duplicate side effect; retry/backoff/dead-letter tests pass; worker survives concurrent claim race (two workers, no double-publish). | High |
| `NC-E3-04` | `planned` | `stale-open-redispatch` | Scheduled job re-dispatches stale `open` requests through the outbox. | A request left `open` with no candidate is retried without double assignment (concurrency test); redispatch interval configurable + tested. | High |
| `NC-E3-05` | `planned` | `side-effect-migration` | Move existing inline side effects (nurse availability fan-out, future payout/notification triggers) out of request transactions onto outbox consumers. | `allocate-request.ts` transaction contains only state writes + event/outbox appends (assertion via boundary guard); gate:release green; no new inline side effects possible without failing CI. | High |

## Band NC-CQ — CQRS Boundary Repair (eliminate cross-domain SQL joins)

| ID | Status | Slice | Work | Acceptance Criteria (falsifiable) | Risk |
|---|---|---|---|---|---|
| `NC-CQ-01` | `planned` | `read-model-contract` | ADR-007: read-model strategy (projection tables fed by outbox events vs explicitly-owned query services). Defines which domain owns each projection and the staleness contract. | ADR accepted; projection ownership matrix covers the three violating files; ent-tm n/a justification recorded. | Medium |
| `NC-CQ-02` | `planned` | `referral-projection` | Replace `domain-referral/src/partner-request-projections.ts` joins (`users` × `service_requests`) with an owned read model per ADR-007. | `rg innerJoin\|leftJoin packages/domain-referral` returns zero cross-domain joins; partner views byte-identical on fixture data (golden test). | Medium |
| `NC-CQ-03` | `planned` | `visit-projection` | Same for `domain-visit/src/visit-notifications.ts`. | Zero cross-domain joins in `domain-visit`; notification outputs unchanged on fixtures. | Medium |
| `NC-CQ-04` | `planned` | `nurse-credential-projection` | Same for `domain-nurse/src/credential-lifecycle.ts`. | Zero cross-domain joins in `domain-nurse`; credential lifecycle E2E green. | Medium |
| `NC-CQ-05` | `planned` | `join-boundary-guard` | Extend `architecture:boundaries` to fail on any domain package importing another domain's schema tables or joining across domain table ownership map. | Committed negative test: a synthetic cross-domain join fails CI; ownership map file is the single source for table→domain. | Medium |

## Band NC-E5 — PHI Data Lifecycle (`ent-dlv` machinery)

| ID | Status | Slice | Work | Acceptance Criteria (falsifiable) | Risk |
|---|---|---|---|---|---|
| `NC-E5-01` | `planned` | `phi-classification` | Populate `data-classification.json` (from NC-EG-03) for every column: class, retention period, erasure strategy, jurisdiction notes (HIPAA retention vs erasure carve-outs). | Manifest covers 100% of columns (gate-verified); PHI inventory reviewed and signed in PR; classification doc cross-links ADR-001 jurisdiction scope. | High |
| `NC-E5-02` | `planned` | `phi-read-audit` | Audit **reads** of PHI-bearing resources via `platform-audit` helper; logs carry actor/resource/field-class, never PHI values. | Read-audit test proves access is logged; log-content test proves zero PHI in audit rows; admin timeline endpoint covered. | High |
| `NC-E5-03` | `planned` | `key-management-adr` | ADR-006: envelope encryption + KMS choice; per-patient DEK design enabling crypto-shredding; key rotation policy. | ADR accepted with security review evidence; threat model (`ent-tm`) for key compromise scenarios. | High |
| `NC-E5-04` | `planned` | `field-encryption` | Encrypt PHI columns per manifest (patient address/geo/`care_type`, visit `summary`) with per-patient DEKs; expand/contract migration. | Round-trip tests; migration proof on production-shaped fixture; query paths (dispatch geo!) explicitly resolved — dispatch distance computation redesigned or geo declared operationally-necessary plaintext in the manifest with justification. | High |
| `NC-E5-05` | `planned` | `crypto-shred-erasure` | Erasure = DEK destruction (crypto-shredding) + hard-delete for non-retained rows; retention jobs on NC-E3 jobs backbone; legal-hold override. | Erasure test: post-shred, PHI fields unrecoverable while audit/event skeleton survives per retention rules; scheduled retention job tested; runbook for subject-rights requests. | High |
| `NC-E5-06` | `planned` | `ops-slos-audit-export` | SLOs + alerting beyond single webhook; exportable immutable audit evidence. | SLO dashboard/runbook exist; export test produces verifiable artifact; `ent-perf` budgets cross-referenced. | Medium |

## Dependencies

```text
NC-EG-01 ──► NC-EG-02/03/04 ──► (all subsequent slices run under gates)
NC-E2-03 (amended) ──► NC-E2-04
NC-TB-01 ──► NC-TB-02 ──► NC-TB-03 ──► NC-E5-02/04 (RLS before PHI controls)
NC-E3-02 ──► NC-E3-03 ──► NC-E3-04/05 ──► NC-CQ-02/03/04 (event-fed projections)
NC-EG-03 ──► NC-E5-01 ──► NC-E5-03 ──► NC-E5-04 ──► NC-E5-05
```

## Recent Closeout Evidence

| Slice | PR | Merge Commit | Gate Summary |
|---|---|---|---|
| `NC-EG-00 / constitution-deployment` | `https://github.com/arbenl/nurseconnect-v3/pull/101` | `b2baa0a80572a2eb10471dcd02c1c945928fc0ef` | Phase C governing docs and ADR-005 merged; docs-only verify-slice static + required gates passed with run root `tmp/multi-agent/verify-slice/verify-slice-20260612T214308Z-c2ad6b`; CI, Sonar, GitGuardian, PR Finalizer, E2E API, UI smoke, and pre-push strict release gate passed. |
| `NC-EG-01 / ent-gate-framework` | `https://github.com/arbenl/nurseconnect-v3/pull/105` + `https://github.com/arbenl/nurseconnect-v3/pull/106` | `246b74e6f569cd20464f6ec82fce7d4bfae5c740` + `08fbced6a586353aa3884a1cfcf238bfa60bca96` | Ent-gate framework and green-check branch-protection parity merged; verify-slice static/required gates, CI, Sonar, GitGuardian, PR Finalizer, E2E API, UI smoke, and branch-protection audit passed. |
| `NC-E2-03 / platform-authz` | `https://github.com/arbenl/nurseconnect-v3/pull/109` | `945b09362a786c082a71f2e4fbd77a372c7df452` | Platform authz package, branded policy decisions, `AuthorizedTransition` status proof tokens, action/resource-kind binding, raw status-write guard, CAS tests, local verify-slice static/required gates, ent-gates, CI, Sonar, GitGuardian, PR Finalizer, E2E API, UI smoke, bot-thread guard, and model-route blocked disposition passed. |
| `NC-TB-01 / tenant-expand` | `https://github.com/arbenl/nurseconnect-v3/pull/114` | `48eb6fab9bd83712245716998c0cdf9bd6bbe196` | Nullable tenant/care-site expansion and default backfill, payment-request ownership constraints, forged-context regression, exact rollback rehearsal, verify-slice static/required gates, ent-gates, CI, Sonar, GitGuardian, PR Finalizer, E2E API, UI smoke gate, reviewer/security disposition, and bot-thread audit passed; blocked external model routes were not counted as approval. |

## Closeout discipline

Identical to `current-program.md`: design review before branch; one
`codex/<slice>` branch; `verify-slice` static + required gates (now including
ent-*); fix or technically reject every `MUST_FIX`; merge only with all required
checks green; record closeout evidence here and in `current-tracker.md`; promote
the next slice from clean `main`.
