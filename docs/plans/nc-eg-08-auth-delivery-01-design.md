# NC-EG-08 / AUTH-DELIVERY-01 Design

Date: 2026-11-03. Owner: platform + QA/architecture. Tier 3 gate infrastructure.
This PR is an eight-file authority promotion and NC-EG-07 closeout only.
No source installation, gate amendment, runtime or 03A/03B implementation occurs.

## Verified Prerequisites And Closeout

PR #121 merged at `1dced12b877600515dfc6b5432b31cb972d892b3` on 2026-11-03 from reviewed HEAD `2ad40d4980d7137a081883f6f2f67338b5dfb1d3`; all eleven PR checks, including the nine required issuer-bound checks and PR Finalizer, passed. Real @arbenl CODEOWNER approval [5747374328](https://github.com/arbenl/nurseconnect-v3/pull/121#pullrequestreview-5747374328) covers that head; no unresolved threads. Merge-commit [main CI 41580156138](https://github.com/arbenl/nurseconnect-v3/actions/runs/41580156138) concluded success. Clean main, reviewed/merged tree equality and deletion of only the merged feature branch were verified. Local run root: `tmp/multi-agent/verify-slice/nc-eg-07-sentry-isolation-final2-20261102`; default/static/required gates, five pool roles, Codex senior and actual Concord/Opus advisory review have zero outstanding MUST_FIX. Legacy Sonnet/Gemini routes were not run and are not counted as approval; no strict legacy gate pass is claimed. Local ignored receipts remain in the operator packet, not hosted CI artifacts.

NC-EG-09 fixture/governance repair merged through PR #119 and its canonical
closeout/promotion through PR #120. The historical three failing bootstrap
fixtures were repaired there; no such test is skipped or weakened here.
Native CODEOWNER review and stale dismissal were actually enforced for PR #121;
strict issuer-bound checks and admin enforcement remain mandatory. The old
2026-11-01 preparation's zero-approval observation is historical, not current.

## Existing Authority Route

Use unchanged authority mode from intentional-null protected main to one matching
NC-EG-08 target across current-program, current-tracker and the enterprise map.
Source branch is codex/auth-delivery-01; all three gates remain required.
Exactly eight regular files: the three canonical records, this design,
docs/threat-models/nc-eg-08-auth-promotion.md,
docs/data-lifecycle/nc-eg-08-auth-promotion.md,
docs/performance/nc-eg-08-auth-promotion.md and slice-gates.yaml.
No executable, test, workflow, CODEOWNERS, config or operator file is in the diff.

## Subsequent Implementation Contract

After this authority PR's green merge/main verification, clean main sync,
own-branch cleanup and canonical readback, create a fresh standard-mode branch
against its genuinely promoted base. The new mode must never authorize its own
installation; unchanged base validation and protected final-head review apply.
Restore intentional-null in that implementation head; completion needs green
merge, main Actions and canonical closeout. This PR does not implement that mode.

Add an explicit null-preserving authority-maintenance capability, without changing
standard, authority or expired-bootstrap semantics. Missing trusted-base support
fails maintenance only, never all existing modes. No global override or bypass.

All six base/head program/tracker/enterprise states must parse intentional-null.
Reject malformed, mixed-target or ready implementation records, and any 03A/03B
promotion or implementation. Maintenance cannot carry source, gate, config,
workflow, migration, model-route, clinical or product-runtime changes.

An immutable already-merged BASE authorization record must bind maintenance
identity, source branch and the exact separately reviewed safe documentation set,
manifest and three required fresh evidence paths. The earlier 16-path proposal
is not silently adopted by this promotion; its final inventory requires review
in the implementation design. No head-created or broadened record may authorize
its own use. Keep ent-tm, ent-dlv, ent-perf and manifest/diff evidence mandatory.

Pin installed policy/record hashes, rather than unknown future closeout contents.
Actual final-head independent CODEOWNER review binds mutable documentation and
real merge receipts. Future-content preauthorization creates a temporal cycle;
its rejection does not waive policy pins, exact paths or final-head review.

Select trusted base/head/repository identities from the GitHub runner event.
Require event base = current protected main = diff base = policy base and correct
head or expected merge parents. Forks, conflicting input and base/head drift fail.
Run BASE-version maintenance policy, not head code merely reading base data.
Deny incomplete or forged evidence and do not execute document/frontmatter text.

Use two-dot diff, rename/copy detection disabled, exact paths plus staged/unstaged/
untracked checks and ancestry. Reject mode changes, symlinks, gitlinks, traversal,
case collisions, duplicates, .gitmodules/.gitattributes and merge-parent laundering.
Prove permitted paths are disjoint from policy, records, runner and CODEOWNERS.

Require observed nine check identities/issuers, strict status, enforced admins,
CODEOWNER approval, stale dismissal and final-head review. If the CI identity
cannot read required protection/review data, the new capability fails closed;
local CLI access is not proof of CI access. Resolving that access boundary is
part of the separately reviewed implementation, not an implicit permission grant.

## Falsifiable Acceptance For Installation

Real-Git and finalizer tests must reject wrong repo/fork/branch/slice/base/head,
head-only or edited policy/authorization, absent/malformed/oversized/non-UTF8
records, hidden or surplus paths, modes, symlinks, stale reviews, missing owner
coverage, missing evidence, guarded n/a, stale manifest hashes and forged PASS.
Every maintenance path and new critical module needs tested owner coverage.
New checked source files remain <=150 lines; split oversized touched modules.
All original mode assertions and required gate thresholds remain unchanged.

## This Promotion's Verification And Publication

Existing authority positive/negative checks, reviewer pool, actual GPT 6+ senior
review and full required gates must pass on this exact head before PR creation.
The manifest makes the runner choose its normal non-docs-only lane; no downgrade.
If existing manifest-dependent tests fail, stop and report them; do not widen
this diff, skip tests, reinterpret assertions or amend a gate in this package.

Use a separately reviewed closeout-only App publisher bound to this exact source.
The frozen PR #121 publisher remains immutable; no credentials enter model context.
Fresh independent native human CODEOWNER approval is required for this PR.
Completion/promotion is canonical only after green merge and GitHub readback.
Keep this PR's own evidence locally; do not recurse into bookkeeping PRs.

## Review Disposition And Non-Goals

Opus design consultation through NurseConnect-only Concord served claude-opus-5;
5.5 is not claimed. Its acceptance conditions are applied to the actual package.
Independent source/operator byte review and all gates remain separate evidence.
Legacy Sonnet/Gemini routes were not run and are not counted as approval.
No strict legacy model-route gate pass is claimed.

Preserve the separate model-policy, SRS, workflow-closeout and harmonization drafts.
Do not change App permissions, branch protections or authentication behavior here.
No tenant enforcement, outbox/worker, read-model or healthcare-control implementation.
The TB03 observation/staging/classification holds and 03A/03B prohibition remain.
