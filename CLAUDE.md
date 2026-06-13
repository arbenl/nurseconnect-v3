# NurseConnect V3 — Claude Agent Instructions

Read `AGENTS.md` (repo root) **before any work**: it is the binding NurseConnect
Enterprise Constitution — the Four Mandates, authority chain, slice workflow,
and modularity guard.

Authority chain: `docs/plans/current-program.md` (singular source of truth) →
`docs/plans/current-tracker.md` → `docs/plans/ENTERPRISE_UPGRADE_TRACKER.md`
(Phase C execution map) → `AGENTS.md`.

When executing any slice from `ENTERPRISE_UPGRADE_TRACKER.md` or
`current-tracker.md`, follow the SOP at
`.claude/skills/nurseconnect-execution-runner/SKILL.md`. Never mark a slice
complete without recorded `pnpm verify-slice -- --required-gates` evidence.

The Four Mandates in one breath: no bare-row mutations — state changes co-commit
evidence today and use the Transactional Outbox once `platform-events`
(NC-E3-02) lands, and no new inline side effects inside `db.transaction` ever;
no cross-domain SQL joins — read models only (the three legacy joins in
`domain-referral`/`domain-visit`/`domain-nurse` are quarantined NC-CQ debt, do
not extend them); no raw string states — core mutations require phantom-typed
proof tokens (`AuthorizedTransition`, `MedicalEvidence`, branded
`OrganizationId`); no PR without `verify-slice --required-gates` passing,
including `ent-tm`/`ent-dlv`/`ent-perf` assertions once NC-EG-01 merges.

Standing rules: never relax a gate to make a slice pass; notifications are
post-commit and non-PHI; never log or message PHI; no Firebase in active code;
keep new files ≤ 150 lines (`pnpm modularity:guard`); Interdomestik is a
copy-and-own reference, never a dependency.
