# Launch Readiness Review Runbook

## Purpose

This runbook is the M5 launch readiness review for NurseConnect v1.0.0.
It converts the current launch scope into explicit go/no-go evidence so the
release decision is not based on memory, chat history, or implicit manual
checks.

## Current Verdict

Status: ready for a final controlled launch execution decision, subject to the
production hard gates in
[Controlled Launch Execution Readiness](controlled_launch_execution_readiness.md).

Last assessed: 2026-04-25 after M15 Program Roadmap Lock merge.

NurseConnect has the core launch controls needed for a managed, referral-led
in-home nursing dispatch product:

- referral partner request intake and partner-scoped visibility
- explicit request triage and exception handling
- private-pay authorization and payout traceability
- active service-area controls for launch geography
- verified nurse supply gating
- admin queues, activity, audit trail, and request detail operations
- deterministic CI and release gate commands

Final launch intake remains closed until the operational preconditions below are
true in the target production environment and the operator records a GO decision.

## Required Production Preconditions

- Production `DATABASE_URL` points to the direct database URL used for
  migrations.
- Runtime database pooling is configured through `DATABASE_POOL_URL` when the
  production platform provides a pooled connection.
- `APP_URL` and `BETTER_AUTH_URL` match the canonical production origin.
- `BETTER_AUTH_SECRET` is configured and retained across deploys.
- `FIRST_ADMIN_EMAILS` contains the initial operator emails.
- At least one active service area exists before accepting real requests.
- Authenticated admin ops status reports `nurseSupply.launchReady: true`,
  with at least 10 verified, available, dispatch-eligible nurses in every
  active launch service area.
- The production app deploy is reachable at the intended hostname.
- The production database has been migrated to the current head migration.

Use the [Production Bootstrap Runbook](production_bootstrap_runbook.md) for the
environment and admin bootstrap procedure.

## Environment Tier Distinction

### Preview

- `VERCEL_URL` is auto-injected by Vercel. Do not set it manually.
- `DATABASE_URL` should point to a staging, preview, or test database.
- `FIRST_ADMIN_EMAILS` can use test operator emails.
- Service areas and verified nurse supply are optional for deploy previews
  because CI covers the controlled service-area and dispatch paths.
- A green preview deploy is not production launch approval.

### Production

- `APP_URL` must be set to the canonical production hostname.
- `BETTER_AUTH_URL` must match `APP_URL` unless `APP_URL` is the only auth
  origin configured.
- `DATABASE_URL` must be the direct, non-pooled production URL used for
  migrations.
- `DATABASE_POOL_URL` should be the pooled runtime connection when available.
- At least one active service area must exist before accepting real requests.
- Authenticated admin ops status must report `nurseSupply.launchReady: true`
  before accepting real requests.
- Production readiness requires the manual launch rehearsal, not only green CI.

## Scope Truth

### In Scope For v1.0.0

- Patient request intake into the shared request lifecycle.
- Referral partner request intake and partner request progress visibility.
- Verified nurse onboarding, credential review, and availability controls.
- Dispatch selection, assignment, reassignment, and nurse request actions.
- Admin active queue, exception queue, request detail, triage, reassignment,
  payment trace, service-area controls, and audit trail.
- Private-pay authorization and payout traceability for manual launch
  operations.
- Service-area intake gating and dispatch scoping for launch geography.

### Explicitly Out Of Scope For v1.0.0

- Insurance reimbursement workflows.
- Real payment processor capture, settlement, or automatic payout execution.
- Polygon/PostGIS geofencing.
- White-label or partner-branded portals.
- Advanced organization administration beyond referral partner MVP needs.
- Multi-city expansion logic beyond active service-area configuration.
- Automated nurse capacity planning.

## Accepted Exclusions for v1.0.0 Launch

These are known limitations accepted for the controlled launch:

- No automated payment capture or settlement; private-pay operations remain
  manual.
- No automated payout execution; nurse payouts remain manually operated.
- No insurance reimbursement workflows.
- No polygon geofencing; service areas are circle-radius based.
- No multi-city expansion automation.
- No white-label partner portals.
- No automated nurse capacity planning.
- No real-time push notifications; launch notification reads are
  polling/read-model based.

## Merged Launch Evidence

| Milestone | Status | Evidence |
| --- | --- | --- |
| M1 Referral Partner MVP | Done | PR #48 design/plan, merge commit `f5f24133b84d9a72e3be6f724e5e326682d2f9fb`; PR #49 implementation, merge commit `aa04ee94e684e72d682b6b01aa7e0fc9df555e26` |
| M2 Triage and Exception Model | Done | PR #50, merge commit `4256f568d3052005b52622acc706678cd23bb307` |
| M3 Private-Pay and Payout Traceability | Done | PR #51, merge commit `ba54509d7acf2fdd49ca37caeb16cebbb67c77b7` |
| M4 Service-Area Controls | Done | PR #52, merge commit `2905c8d338964a3a70d8f1602d5851c04144b8a4` |
| M5 Launch Readiness Review | Done | PR #53, merge commit `debf2455532ea9e83c9535067880e5fe599f2532` |
| M6 Automated Launch Rehearsal | Done | PR #54, merge commit `60e270a50442a88587af058bc3552e4f9fcf6e96` |
| M7 Full Milestone Browser Rehearsal | Done | PR #55, merge commit `0117fabdd2cb810a6c51ce9497e31425f9dc71aa` |
| M8 Production Monitoring and Alerting | Done | PR #56, merge commit `38d947fe32a5c428f8ef85cabcf83b1709c3af68` |
| M9 Roadmap Reconciliation and Next-Slice Program Plan | Done | PR #57, merge commit `d36671de95653544a74c3613fcd270db6ee16848` |
| M10 First-Hour Production Synthetic Monitoring | Done | PR #58, merge commit `b9116751c3c5321f2d666f25539cc48bad9f8ee1` |
| Workflow Standardization | Done | PR #59, merge commit `c7f8263349cd83eb90a355bac542b3b4508b89b9` |
| M11 Auth and Session Degradation Monitoring | Done | PR #60, merge commit `a356ea367e87698e7d0a8af8065b3a5678508161` |
| M12 Launch Operator Console Hardening | Done | PR #61, merge commit `b242ec2e2b42ceff8d69399f5041f9b22f937139` |
| SonarCloud Baseline and Local Sonar Support | Done | PR #63, merge commit `5b1b2256c864ce81340e23df25c07a1816b16501` |
| M13 Controlled Launch Execution Readiness Review | Done | PR #62, merge commit `6739c9d95ea983bc819817289feb8706fb5723ca` |
| M14 Rehearsal Browser Hardening | Done | PR #64, merge commit `79457dbbc90e52d663ce54136917039f0767ee4b` |
| SonarCloud PR Quality-Gate Parity | Done | PR #65, merge commit `475f20e0b0f0dcddf438ee01206d2755e6ca13f7` |
| M15 Program Roadmap Lock | Done | PR #66, merge commit `a4b336fc15625bcb4df275cd37ac67c944b5bd94` |

## Next Program Slice

The full post-M14 program sequence (M15-M19) is locked in
[M15 Program Roadmap Lock Design](../superpowers/specs/2026-04-24-program-roadmap-lock-design.md).
The table below lists only the next slice to execute.

| Milestone | Status | Evidence |
| --- | --- | --- |
| M16 CRM Boundary Design | Current design slice | [M16 CRM Boundary Design](../superpowers/specs/2026-04-25-crm-boundary-design.md) |

## Required Validation Commands

Run these from a clean, synced `main` before launch rehearsal:

| Command | Expected result |
| --- | --- |
| `pnpm env:check` | Validates environment parsing. |
| `pnpm launch:readiness` | Confirms launch-critical docs, scripts, and test coverage entry points are present. |
| `pnpm launch:readiness:json` | Returns the same readiness result in structured form for CI or PR automation. |
| `pnpm launch:rehearsal` | Runs readiness plus the automated launch rehearsal API flow for health, admin, service area, patient/nurse lifecycle, payment trace, partner intake, and exception triage. |
| `pnpm launch:browser-rehearsal:headed` | Runs the full milestone browser rehearsal in visible Chrome with slow interactions for operator observation. |
| `LAUNCH_MONITOR_ADMIN_COOKIE='<cookie header>' pnpm launch:monitor -- --url <production-url> --once --require-admin-ops` | Polls launch health and authenticated admin ops status for first-hour production monitoring. Authenticated ops polling is required for the production GO path. |
| `pnpm launch:auth-monitor -- --url <production-url>` | Validates synthetic admin sign-in, `/api/me` session bootstrap, admin RBAC reachability, and sign-out without printing credentials or cookies. |
| `pnpm gate:release` | Runs type-check, lint, web build, unit/architecture tests, API tests, E2E API gate, and UI smoke gate. |
| PR CI `Sonar Quality Gate` | Must be green and blocking. The best-effort PR-facing Sonar summary should be reviewed when present, but a green scheduled `Sonar Baseline` alone is not sufficient for release readiness. |

## Rehearsal Seed

For local or staging rehearsal data, use:

```bash
pnpm launch:seed
```

The seed script creates or reuses:

- one active Pristina service area
- one admin user
- ten verified, available nurses with locations inside the service area
- one patient user
- one active referral partner profile

The script refuses non-test/non-rehearsal databases unless
`I_KNOW_WHAT_I_AM_DOING=1` is set. Do not run it against production.

## Manual Launch Rehearsal

Use this rehearsal after deployment to the target environment.

**Scope:** staging always; production only as a synthetic, no-PHI rehearsal
after deployment and before controlled intake opens. Do not submit real
patient, referral partner, or nurse operational data until the formal launch
decision is GO.

1. Confirm `GET /api/health/db` returns `{ ok: true, db: "ok" }`.
2. Run `pnpm launch:rehearsal` against local/test before manual production
   rehearsal.
3. Bootstrap the primary admin through `/api/me` using an email in
   `FIRST_ADMIN_EMAILS`.
4. Confirm `/api/admin/ping` returns the admin role.
5. Create or verify the launch service area in Admin -> Service Areas.
6. Create or verify at least one nurse profile with valid credentials.
7. Mark the nurse verified and available.
8. Submit a patient request inside the active service area.
9. Confirm the request is assigned to an eligible nurse inside that service area.
10. Complete the nurse lifecycle: accept, enroute, complete.
11. Confirm request timeline, visit projections, payment trace, and payout trace
    are visible to the expected admin/user surfaces.
12. Submit or simulate a referral partner request and confirm partner-scoped
    visibility.
13. Exercise one exception flow: needs review, decline or unfulfilled, then
    reopen when appropriate.
14. Confirm anonymous users are redirected away from `/dashboard` and `/admin`.

## Go/No-Go Checklist

Go only when all items are true:

- [ ] `pnpm gate:release` passes on clean `main`.
- [ ] Latest release PR included a green `Sonar Quality Gate` check and PR
      summary.
- [ ] `pnpm launch:readiness` passes on clean `main`.
- [ ] `pnpm launch:rehearsal` passes on clean `main` against local/test.
- [ ] `LAUNCH_MONITOR_ADMIN_COOKIE='<cookie header>' pnpm launch:monitor -- --url <production-url> --once --require-admin-ops`
      returns green and does not skip admin ops status before production intake
      opens.
- [ ] `LAUNCH_AUTH_MONITOR_EMAIL` and `LAUNCH_AUTH_MONITOR_PASSWORD` are set in
      the operator terminal, and
      `pnpm launch:auth-monitor -- --url <production-url>` returns green for
      the dedicated synthetic admin credential.
- [ ] Accepted exclusions are explicitly reviewed and signed.
- [ ] Controlled launch execution decision ledger template from
      [Controlled Launch Execution Readiness](controlled_launch_execution_readiness.md)
      is completed in Notion or a private launch evidence artifact, not in the
      tracked repo runbook.
- [ ] Production environment variables are configured.
- [ ] Production migrations have been applied.
- [ ] Primary admin bootstrap is verified.
- [ ] `GET /api/health` returns `ok: true`.
- [ ] At least one active launch service area exists.
- [ ] Admin ops status reports `nurseSupply.launchReady: true`.
- [ ] `GET /api/admin/ops/status` is reachable by an authenticated admin and
      confirms launch thresholds are green.
- [ ] Patient request, partner request, nurse assignment, visit completion,
      payment trace, payout trace, and exception handling are rehearsed.
- [ ] Known exclusions are accepted by the operator.
- [ ] Rollback path is understood before launch.

## Controlled Launch Execution Decision

Use [Controlled Launch Execution Readiness](controlled_launch_execution_readiness.md)
as the final operator decision template. Copy the completed decision into
Notion or a private launch evidence artifact; do not write production evidence
into the tracked repo runbook. The launch decision must be one of:

- **GO**: every hard launch gate is green, any soft gate has an accepted
  mitigation, the authenticated first-hour monitor is ready to start before
  intake opens, and the launch operator can watch Admin -> Dashboard -> Launch
  operator signals.
- **HOLD**: no hard gate is red, but a soft gate needs a bounded mitigation
  before intake opens. HOLD requires an owner, mitigation, and re-check time.
- **NO-GO**: any hard gate is red, production state cannot be verified, or a
  secret/token/PHI exposure occurs. Intake must remain closed.

Minimum hard gates for GO:

- production deploy reachable at the canonical URL
- latest release PR had a green blocking `Sonar Quality Gate`
- `/api/health` returns `ok: true`
- active service area count greater than 0
- authenticated admin ops status reports `nurseSupply.launchReady: true`
- primary admin and synthetic admin auth checks pass
- `LAUNCH_MONITOR_ADMIN_COOKIE='<cookie header>' pnpm launch:monitor -- --url <production-url> --once --require-admin-ops`
  passes for production and does not skip admin ops status
- authenticated `/api/admin/ops/status` is reachable
- unassigned requests below 3
- stale enroute requests equals 0
- recent failed payment authorizations equals 0
- recent failed payouts equals 0
- rollback owner and pause-intake owner are named

Escalate or no-go when any launch threshold is breached:

- `GET /api/health` does not return `ok: true`: stop launch or pause intake
  immediately.
- `Sonar Quality Gate` is missing, skipped, or red on the release PR: do not
  merge or launch until the gate is green.
- Active service areas equals 0: do not launch or pause intake.
- `nurseSupply.launchReady` is false or
  `launchServiceAreasBelowMinimum > 0`: do not accept new requests.
- Unassigned requests are 3 or more for more than 5 minutes: escalate to the
  operator.
- Any stale enroute request exists: escalate to the operator.
- Exception queue is 5 or more: operator review is required before expanding
  intake.
- `pnpm launch:monitor` exits nonzero: pause intake and inspect the printed
  failure before proceeding.
- Any recent failed payment authorization or payout exists: finance and
  operator review is required.
- `pnpm launch:auth-monitor` exits nonzero: stop launch or pause intake until
  sign-in, `/api/me`, and `/api/admin/ping` are green with the synthetic admin.
- The synthetic admin password, session cookie, or Better Auth token appears in
  any log, PR, Notion page, or terminal transcript: rotate the credential and
  treat the copied output as sensitive.

## Rollback Guidance

For application regressions:

1. Stop new intake if needed by pausing the affected service area.
2. Revert the merge commit that introduced the regression or redeploy the last
   known-good production build.
3. Re-run `pnpm gate:release` before redeploying the revert.

For data or migration issues:

1. Stop new intake.
2. Preserve the production database for investigation.
3. Restore from the last verified backup if the migration cannot be corrected
   forward safely.
4. Apply a forward correction migration rather than editing applied migration
   history.

## Owner Notes

This runbook is intentionally conservative. v1.0.0 is a controlled launch, not
a broad marketplace launch. The release should optimize for operational
truthfulness, traceability, and narrow geography over feature breadth.

## Formal Sign-Off

Accepted exclusions reviewed at sign-off:

| Accepted exclusion | Operator initials |
| --- | --- |
| No automated payment capture or settlement; private-pay operations remain manual. | |
| No automated payout execution; nurse payouts remain manually operated. | |
| No insurance reimbursement workflows. | |
| No polygon geofencing; service areas are circle-radius based. | |
| No multi-city expansion automation. | |
| No white-label partner portals. | |
| No automated nurse capacity planning. | |
| No real-time push notifications; launch notification reads are polling/read-model based. | |

Operator signature: __________________________

Date: __________________________
