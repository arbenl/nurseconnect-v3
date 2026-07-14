# NC-EG-06 Null-Promotion Bootstrap Design

## Slice

- ID: `NC-EG-06`
- branch: `codex/ent-gate-null-promotion-bootstrap`
- risk: Tier 3 shared constitutional gate infrastructure
- base: `e8b3c5c38650ed3bcc0d64de538cc4247598f49a`

## Problem

Normal policy validates against the promoted base tracker. An intentionally
null base therefore blocks even a reviewed authority-only promotion; disabling
promotion enforcement or trusting the head would create a reusable bypass.

## Scope

Add two explicit fail-closed modes while preserving existing standard behavior:

1. permanent `authority` mode for an intentional base `null` to exactly one
   head promotion; and
2. one-shot `bootstrap` mode that installs the permanent mode while both base
   and head trackers remain intentionally null.

Evidence must state the selected mode. No PHI, secrets, or production data are
read or written.

## Tracker State Contract

A strict parser returns `promoted`, `intentional-null`, or `malformed`.
Intentional null requires one section, its canonical statement, and no record;
promoted requires exactly one record and no null statement. Missing, duplicate,
ambiguous, multiple, or mixed states are malformed.

## Permanent Authority Mode

The manifest must declare `promotion-mode: authority`; its slice and branch are
the target. The gate requires all of the following:

- fixed canonical paths only; all three base authority records parse as `intentional-null`
- all three head records parse the same single promoted slice/branch target
- resolved same-repository source branch equals the manifest and all head targets
- supplied changed files exactly equal independently collected git changes
- every change is in the closed authority-only path set below
- product/runtime/schema/workflow/gate-tooling/package/config paths are absent

The permanent path set is manifest-bound and exact for each authority PR:

- `docs/plans/current-program.md`
- `docs/plans/current-tracker.md`
- `docs/plans/ENTERPRISE_UPGRADE_TRACKER.md`
- `slice-gates.yaml`
- every required gate evidence path declared by that manifest
- a non-empty comma-separated `authority-files` declaration restricted to
  exact approved Markdown design/runbook paths under `docs/plans/` or
  `docs/runbooks/`

The diff must equal that set and every allowed head path must survive as a
regular non-symlink file; any mismatch fails. This supports the Gemini route
repair promotion before NC-TB-03A without hard-coding either slice's evidence.
Normal mode continues validating against a promoted base; authority mode fails
when the base is already promoted.

## One-Shot Installer Mode

Authorizations v1 (12 files) and v2 (14 files) are revoked and retained in the
audit trail. Authorization v3 uses schema/version 3, count `15`, and file-set
SHA-256 `a571089ec113f602ef046d14068648fdda5be70bde448dddfbac8adc6f340835`.
It binds `promotion-mode: bootstrap` and `NC-EG-06` to:

- exact policy base SHA `e8b3c5c38650ed3bcc0d64de538cc4247598f49a`
- exact branch `codex/ent-gate-null-promotion-bootstrap`; detached GitHub PRs also prove from event metadata that the head repository matches `GITHUB_REPOSITORY`
- base and head tracker states both `intentional-null`
- an exact finite changed-file set

The finite set is exactly:

- `config/ent-gate-null-promotion-bootstrap.json`
- `docs/data-lifecycle/nc-eg-06.md`
- `docs/performance/nc-eg-06.md`
- `docs/plans/nc-eg-06-null-promotion-bootstrap-design.md`
- `docs/threat-models/nc-eg-06.md`
- `scripts/__tests__/check-pr-slice-evidence-fragility.test.mjs`
- `scripts/__tests__/check-pr-slice-evidence.test.mjs`
- `scripts/ent-gates/__tests__/ent-gates-tracker.test.mjs`
- `scripts/ent-gates/__tests__/promotion-policy.test.mjs`
- `scripts/ent-gates/check.mjs`
- `scripts/ent-gates/evidence.mjs`
- `scripts/ent-gates/manifest.mjs`
- `scripts/ent-gates/promotion-policy.mjs`
- `scripts/lib/pr-ent-gate-evidence.mjs`
- `slice-gates.yaml`

Any tracker, workflow, package, runtime, schema, migration, auth, tenancy
implementation, or production-config change fails. `slice-gates.yaml`
intentionally appears in both modes. The record expires after the base changes.

## Companion PR-Evidence Disposition

The v2 companion removes the legacy disabled-promotion child call. With a real
base it runs full normal enforcement. Only non-CI fixtures with a declared
complete file list may directly run structural manifest, evidence, and guarded
path validation; this is never labeled promotion enforcement. CI/PR without a
base fails closed. No exception or new bypass is added to `check.mjs`.

## Implementation Boundaries

- `promotion-policy.mjs`: strict tracker, branch, exact-set, and record policy
- `manifest.mjs`: accept only the two named modes plus standard mode
- `check.mjs`: atomically dispatch one mode without a generic bypass
- `evidence.mjs`: record mode, resolved policy-base SHA, and source branch
- focused tests: pure negative matrix plus detached-head/CI integration

No environment-only override, branch wildcard, head-only standard validation,
or generic `--enforce-promotion false` path is introduced. Special modes reject
that flag and still load the base policy. Local and GitHub branch identities
must agree; a GitHub head ref is accepted alone only in detached PR Actions whose trusted event metadata proves a same-repository head.

## Negative Test Matrix

- missing/malformed/duplicate/conflicting canonical base or head authority record
- null marker mixed with a promotion; zero or multiple head promotions
- unchanged head tracker, target mismatch, or source-branch/target mismatch
- incomplete or surplus changed-file enumeration
- unexpected authority path, deleted/symlink artifact, and every forbidden path class
- missing/wrong bootstrap record, base SHA, branch, identity, or file set
- bootstrap with a tracker change or promoted base/head
- authority mode when the base is already promoted
- standard-mode regression against the base tracker
- one canonical passing case for standard, authority, and bootstrap modes
- local branch and detached-head branch plus head-repository provenance resolution

## Verification And Rollback

Run focused ent-gate tests, the full script test suite, modularity and
architecture guards, one-run-root static/reviewer/security/required gates,
Codex senior review, Sonnet and Gemini critique, and Fable escalation when
callable. Branch text is not the security boundary: exact policy-base SHA, git
lineage, shallow-safe base-to-HEAD tree diff, manifest target, and closed paths bind
reviewed content in local and detached-head CI. Two authority PRs from the same
null base may initially validate; strict up-to-date branch protection must
revalidate the second against updated `main`, where the non-null base makes it
fail. The PR remains held for explicit control-plane disposition.

Special-mode enumeration proves full-history ancestry or the raw commit header confirms the exact shallow HEAD parent,
then uses a rename-decomposed base-to-HEAD tree diff without requiring a three-dot merge base in PR Finalizer's depth-one checkout.

Rollback reverts the bootstrap PR. Because standard behavior remains the
default and the one-shot SHA is expired after merge, rollback cannot silently
authorize a product slice.
