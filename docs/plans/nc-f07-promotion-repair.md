# Park NC-EG-08 And Promote F07 Repair

Date: 2026-11-17. Administrative queue disposition only.
Owner authorization: "Yes, authorize the limited F07 manifest and promotion
repair. Keep all three gates required, finish verification, and prepare the PR.
I'll approve the merge."

## Scope And Admission

Base: origin/main 353bc6606e6f91b2c57c15458593a3515501d915.
Actual source branch: codex/nc-f07-promotion-repair. The older
codex/auth-delivery-01 branch belongs to a preserved worktree and is not reused.
Eight documentation/manifest files only: three canonical queue records, this
design, three fresh evidence documents and slice-gates.yaml. No F07 source,
gate code, workflow, ruleset, credentials or service configuration changes.

The standard gate intentionally validates against the immutable BASE tracker.
Therefore this administrative delivery retains BASE-admitted
NC-EG-08 / codex/auth-delivery-01 in the manifest. Its HEAD queues F07 as
NC-E0-07 / codex/nc-f07-db-target-safety and parks NC-EG-08. This neither
implements NC-EG-08 nor marks it completed. The retired authority-only fields
belong to the earlier promotion PR, not this standard administrative disposition.
All three ent gates remain required with fresh evidence for this exact scope.

Repository precedent: d1df8da0558fc2631e785b02e3be06154aa84f9e retained
NC-E2-03 in a standard closeout manifest while head trackers promoted NC-E2-04.
The actual source branch there was codex/platform-authz-closeout. Here the
owner explicitly revises priority; parking is recorded without inventing merge
or implementation evidence. Independent architecture review confirmed the path.

## F07 Acceptance And Subsequent Delivery

F07 is the shared destructive-test DB target policy already reviewed with Opus
5.5: loopback/approved disposable targets only, effective pool/direct consistency,
denial before connect/TRUNCATE, and positive local/CI test-lane compatibility.
Its source and implementation evidence remain on the separate F07 branch.

After the OWNER merges this promotion green, verify protected main and canonical
readback, rebase the separate F07 branch, and bind its standard manifest to F07.
F07 cannot self-authorize against its own unmerged head. No stacked-branch
verification is substituted for promoted main. No implementation PR opens before
its applicable required gates pass against that genuinely promoted base.

## Preserved Holds And Non-Goals

NC-EG-08 is parked, not cancelled or completed. No interrupted credential or
communication task is resumed. 03A/03B and NC-TB-03 observation, restrictive
staging/two-tenant proof and classification holds remain. Audit governance/SRS
drafts remain advisory. No all-findings ZERO prerequisite is introduced.
Next repairs remain F03+F09, then F01 after D02, then F02/F05 and F06 as their
dependencies permit. F04/F16 precede organization two.

## Verification And Rollback

Run unchanged verify-slice default, static and required lanes, fresh ent evidence,
modularity, architecture, generated reviewer pool and senior review. The manifest
means the runner selects its normal full release lane; do not downgrade it.
Use only a task-owned disposable PostgreSQL 16 container on a random loopback
port with temporary storage and synthetic CI fixtures. Preserve all other local
containers and services. Runtime secrets remain in their existing mechanism.

Falsifiable acceptance: base-aware standard admission passes; all three gates
are required; exact eight-file inventory contains no implementation; all three
head records queue F07 and park EG08 without completion; missing/wrong identity,
missing evidence and guarded n/a still fail unchanged existing tests.

Rollback is an owner-reviewed revert of this queue-only change. Neither this PR
nor a review receipt authorizes merge, deployment or patient-data access.
