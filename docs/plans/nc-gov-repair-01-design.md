# NC-GOV-REPAIR-01: bounded governance fixture repair

Status: CANDIDATE PACKET, not owner-adopted, installed or ready for PR.
The owner approved the operating model on 2026-11-01, not this as-yet unhashed patch.

## Scope

One fixed-base amendment at 9882c8b5044d238c398dde8e0ec45b7bf039cc89,
branch codex/governance-fixture-repair. Preserve all three canonical authority files
byte-for-byte intentional-null. No product, tenant, schema or runtime feature work;
03A/03B remain held and EG02/03/04 acceptance is unchanged.
The exact 20 paths are independently listed in root-repair-policy.mjs and the
candidate authorization record. An external complete inventory and patch hash bind
all bytes, including policy and record; neither file can hash/authorize itself.
The record file-set SHA hashes sorted UTF-8 PATH STRINGS plus a final newline, not
file bytes. Including its own path creates no hash fixpoint. Full content/patch
hashes live outside the patch in the owner packet and are independently recomputed.

## Why this amendment exists

Main is intentional-null. Standard admission needs a promoted base; authority
admits exact documents only. Historical bootstrap has expired. Promotion required
release fails three bootstrap tests coupled to the current manifest and branch.
Preserve all assertions by using real private historical Git fixtures and explicit
manifests, adding actual-checker regressions for ambient manifest modes.
No gate threshold, assertion or existing mode is weakened; no bootstrap revival.

## Human authority and adoption

The operating model uses actual App installation authorship and real owner review,
single-operator role separation, not two humans. Establish isolated author context
and trusted publication first; current owner CLI/connector context is not that proof.
Before candidate-policy pre-PR gates, owner independently reads actual repository
diff, recomputes both inventory and patch hashes, and explicitly adopts this exact
fixed-base/branch amendment with expiry. General model approval is insufficient.
Full verify-slice/static, generated reviewers and required gates remain mandatory,
followed by all nine check/issuer identities, strict status/admin enforcement,
CODEOWNER approval, stale dismissal and actual final-head owner review before merge.
Candidate PASS is execution evidence, not legitimacy. Current PR Finalizer executes
head code: no claim that it independently proves installation of this policy.
Never bypass or disable a check; later slices use installed ordinary base policy.

## Admission constraints

Manifest mode governance-repair is distinct from standard, authority and bootstrap.
Its unique slice/branch/base and exact 20-file regular inventory are compiled into
policy and checked against the record. All six base/head authority states stay null;
all three evidence gates are required. Tree mode/symlink/deletion/missing files,
wrong repository/fork/event/checkout, wrong branch/base/hash and reuse are rejected.
Main observation must still equal fixed base; fetch protected main freshly before
publication. A local cached origin/main is not proof of live protection or approval.
Main movement expires this mode; it is not a reusable generic bypass.
A changed patch/head/base invalidates old owner approval and evidence.

## Minimum credential boundary

Install a bounded Node-only collector so future trusted installed-base execution
can verify pinned Sentry project and organization IDs before querying issues.
Output only status/sample count and base/head/target digest; never raw issue rows.
Exactly two requests, no pagination: project identity then one issue sample.
AbortSignal.timeout supplies a total per-request deadline including body streaming.
Reject redirect, foreign origin, missing/auth/transport/schema/size/identity errors;
unresolved issues fail strict CLI. No head imports, package install or hooks.
This does not implement the full future Sentry environment resolver.
The existing manual hardening workflow is NOT rewired or made safe in this patch.
Do not dispatch it on repair/automation PRs until its separately reviewed wiring
uses trusted collector execution and isolates credentials from all head code.
That no-dispatch rule is owner discipline, not server enforcement or a waiver:
manual hardening is not one of the nine required checks. No required path may be
run with privileged secrets exposed to unreviewed PR execution. Sonar source has
step-scoped tokens; actual service privileges remain unknown and must be audited.

## Ownership and recovery

Explicit CODEOWNERS cover new policy/config/evidence entrypoints and manifest.
Remove the old comment suggesting temporarily disabling enforcement.
Compromise means revoke/pause/restore publisher, never lower protection. With the
sole owner unavailable, publication waits; a real second human can author a recovery
PR for owner review. A collaborator alone cannot approve sole-owner-authored work.

## Verification and delivery

Focused deterministic tests only during packet preparation, without credentials.
The three historical test fixes retain their separately reviewed content hashes.
New policy tests cover wrong identity/scope/base/null state/required gates; real-Git
context tests cover tree modes and event provenance; collector tests cover failures
and payload nonretention. Files remain <=150 lines; boundaries/modularity and all
full pre-PR gates are required later on the exact adopted patch.
Do not mistake candidate unit tests for full required-gate evidence or PR readiness.
No commit, PR, merge, source install or canonical status update occurs during prep.
