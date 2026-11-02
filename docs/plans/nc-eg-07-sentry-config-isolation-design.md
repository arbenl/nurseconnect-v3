# NC-EG-07 Sentry Configuration Isolation Design

Date: 2026-11-02. Owner: platform + observability. Tier 3 gate infrastructure.
Owner explicitly authorized Sentry correction and AUTH-DELIVERY-01 separately;
NC-TB-03A/B implementation and gate weakening remain prohibited.

## Canonical Closeout Included

PR #119 is merged at d49dbed219be8b6e6cd83d2b5116cf82fc0b0921 from reviewed
15e11814f9e731bfb44eaf58fc259a3c134664c2 with nine required issuer checks,
real owner approval 5735970209 and no unresolved threads. Actual merge-commit
[CI 41438712094](https://github.com/arbenl/nurseconnect-v3/actions/runs/41438712094)
passed. Own repair branches were deleted; clean main/tree equality verified.
The original run root is `tmp/multi-agent/verify-slice/pr119-finalizer-fixture-20261102`.
This eight-file authority PR records that closeout and only EG07's next promotion.
Completion/promotion becomes canonical only when this PR merges green; then check
its main Actions, sync clean main, clean up its branches and read back all records.
Keep this PR's merge proof in delivery evidence; do not recurse into bookkeeping PRs.
The separate eight local workflow drafts and frozen publisher/25-file repair stay
unchanged. This promotion neither publishes those drafts nor changes gate code.

## Why This Slice

The advisory selected an inherited foreign project rather than the dedicated
NurseConnect identity already held in its local setup. A read-only metadata
probe confirmed exact NurseConnect identity and HTTP 200; a count-only probe
confirmed zero unresolved issues. No foreign project was queried or issue
payload retained by these probes. Account-token access is proved; a new token
is unnecessary. This is a real gate-infrastructure prerequisite, not a product
target or precedent for bypassing product promotion/dependencies.

## Delivery Stages

1. This authority-only promotion uses the unchanged existing authority mode,
   exact eight-file scope and required evidence, from verified clean main.
2. After merge and clean closeout, a fresh standard-mode implementation uses
   that promoted base. Never use newly added logic to approve its installation.
3. Restore intentional-null in the implementation head; record completion only
   after actual green merge. AUTH-DELIVERY-01 follows separately as NC-EG-08.

No stage promotes or implements 03A/03B. Keep the original harmonization draft
and its twelve modified Markdown paths in its existing checkout, unchanged.

## Exact Promotion Scope

- docs/plans/current-program.md
- docs/plans/current-tracker.md
- docs/plans/ENTERPRISE_UPGRADE_TRACKER.md
- docs/plans/nc-eg-07-sentry-config-isolation-design.md
- docs/threat-models/nc-eg-07-sentry-promotion.md
- docs/data-lifecycle/nc-eg-07-sentry-promotion.md
- docs/performance/nc-eg-07-sentry-promotion.md
- slice-gates.yaml

Promotion is NC-EG-07 with branch codex/sentry-config-isolation-delivery, the actual
subsequent infrastructure slice. All three head records must select that same
target; all three main records must be intentional-null. No source/config/
workflow/runtime/database changes belong to this promotion package.

## Implementation Contract — Separate PR

Pin the verified non-secret NurseConnect org/project/HTTPS origin in explicit
repo-owned config, bound to verified immutable org/project IDs as well as routing slugs.
Reject metadata ID mismatch and never commit a DSN. Resolve the token only at runtime: dedicated token preferred,
verified account token allowed only for this pinned target. An independently
scoped NurseConnect token is future hardening, not a fabricated access blocker.
Do not copy tokens into source, evidence, model packets or global configuration.
Never select ambient generic project/base. Dedicated overrides that mismatch
the pin fail; CI generic identity mismatches fail. Surface ignored local drift.

One private request path must validate identity, build the URL and attach the
credential; no other caller holds the token. HTTPS only, exact approved origin,
no redirect following, bounded timeout, no request before identity validation.
Whitespace-only credentials count as missing. Forbidden identity fails before
missing-token handling. Missing credentials and auth/transport/response errors
remain strict failures. No advisory exemptions or threshold changes.

Recognize CI true/TRUE/1 when rejecting advisory mode. Construct a fresh
allowlisted evidence object (status, timestamp, pinned identity, operational
count); never persist raw issue objects/titles/payloads or credential values.
An empty valid live list passes; nonempty, malformed, HTTP 30x/401/403 and
timeout fail. Preserve the existing non-strict missing-config diagnostic only
outside mandatory strict gate execution; it cannot count as live approval.

Expected implementation: a small target resolver/client, thin existing advisory,
non-secret identity config, focused tests and setup/runbook docs. Every checked
new/touched source file stays at most 150 lines; no dependency addition needed.
No app telemetry capture, clinical/PHI behavior, schema, migrations, notifications
or deployment changes. Inspect only targeted CI variable values/secret presence
without disclosing secret values; any remote correction must match the verified
project and remain within the owner-authorized NurseConnect configuration.

## Falsifiable Acceptance

- Actual existing authority checker passes the exact promotion inventory;
  malformed/missing main records, target mismatch and surplus paths fail.
- Only NC-EG-07 is promoted; no 03A/03B ready or implementation state appears.
- Implementation tests prove polluted ambient values cannot retarget requests;
  explicit mismatch/foreign origin, missing/blank token, redirects, invalid API
  shape, 401/403, timeout and CI advisory overrides fail without token leakage.
- Evidence has exactly the allowlisted fields; sentinel strings in mock issue
  titles/payloads/tokens never appear in stored evidence.
- A timestamped strict live NurseConnect zero-count receipt supplements tests;
  all static/reviewer/required/CI/PR Finalizer checks remain mandatory.

## Review And Risk

2026-11-02 closeout-route review also served `claude-opus-5`: exact authority
inventory accepted conditionally; parser/identity requirements are verified before
publication. Opus review is advisory, never native CODEOWNER approval.

Separate Opus subscription design review served claude-opus-5, not verified 5.5.
Accepted findings: single validated credential path; no redirects; positive
allowlist; blank token handling; clean checkout. Original dirty NC-TB-03 work is preserved in its own checkout. No external review is treated as gate approval.
Residual risks: account-token blast radius and provider outage; neither permits
foreign-target fallback, silent retry approval or weakened strict checks.
Rollback only this slice's config/code after reviewed mitigation; preserve holds.
