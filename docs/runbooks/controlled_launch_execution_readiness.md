# Controlled Launch Execution Readiness

## Purpose

This runbook is the final operator decision package for NurseConnect v1.0.0
controlled launch execution. It does not replace the launch readiness review,
launch day card, production bootstrap runbook, automated rehearsal, or monitors.
It ties those artifacts into one explicit GO, HOLD, or NO-GO decision.

Use this runbook only after the target production environment exists and the
operator is ready to decide whether controlled intake can open.

## Decision Inputs

Collect these inputs before making the launch decision:

- Production deploy URL and deploy identifier.
- Current `main` commit.
- `pnpm gate:release` result from clean, synced `main`.
- `pnpm launch:readiness` result from clean, synced `main`.
- `pnpm launch:rehearsal` result from local/test.
- `LAUNCH_MONITOR_ADMIN_COOKIE='<cookie header>' pnpm launch:monitor -- --url <production-url> --once`
  result.
- `pnpm launch:auth-monitor -- --url <production-url>` result using the
  dedicated synthetic admin.
- `GET /api/health` result from production.
- Authenticated `GET /api/admin/ops/status` result from production.
- Admin dashboard Launch operator signals screen observation. If a screenshot is
  needed for evidence, crop it to the non-PHI Launch operator signals area and
  redact any request, patient, partner, payment, or session context before
  sharing it.
- Manual rehearsal outcome for patient request, partner request, nurse
  lifecycle, payment trace, payout trace, and exception handling.
- Accepted exclusions signature from the launch readiness review.

Do not paste session cookies, passwords, Better Auth tokens, full patient
details, or raw PHI into this runbook, Notion, PRs, or chat.

## Hard Launch Gates

All hard gates must be green for GO:

- Production deploy is reachable at the canonical URL.
- `GET /api/health` returns `ok: true`.
- Active service area count is greater than 0.
- Verified and available nurse supply is greater than 0.
- Primary admin can sign in, call `/api/me`, and call `/api/admin/ping`.
- Synthetic admin auth monitor passes.
- First-hour monitor one-shot passes.
- Admin ops status is reachable by an authenticated admin.
- Unassigned requests are below 3.
- Stale enroute requests are 0.
- Recent failed payment authorizations are 0.
- Recent failed payouts are 0.
- Required CI checks on the release branch or `main` are green, including the
  blocking `Sonar Quality Gate` check on the release PR.
- Rollback owner and pause-intake owner are named.

## Soft Launch Gates

Soft gates can produce HOLD instead of NO-GO when the operator accepts a narrow
mitigation:

- Exception queue is non-zero but below 5.
- Stale assigned requests exist, but none are enroute and an operator is
  actively triaging them.
- One payment authorization is missing payout trace in local/test rehearsal
  data, but finance has confirmed it is expected and tracked. Missing payment
  or payout traceability in production is not a soft gate; it is NO-GO until
  the expected trace appears in the admin surface.
- One service area or nurse supply warning exists in preview/staging only, not
  production.
- Browser rehearsal evidence is older than the current merge commit but the
  automated launch rehearsal and production smoke checks are current.

Every HOLD decision must name an owner, mitigation, and re-check time.

## Decision Outcomes

### GO

Use GO only when every hard gate is green, any soft gate has an accepted
mitigation, and the authenticated first-hour monitor is ready. Controlled
launch may open only after the monitor loop is started.

Required actions:

1. Start the authenticated first-hour monitor before opening intake so both
   `/api/health` and `/api/admin/ops/status` are enforced:

   ```bash
   LAUNCH_MONITOR_ADMIN_COOKIE='<cookie header>' \
     pnpm launch:monitor -- --url https://<production-url>
   ```

   The monitor output must show admin ops status as checked, not skipped.
2. Keep `pnpm launch:auth-monitor -- --url <production-url>` available and run
   it at least every 10 minutes during the first hour.
3. Refresh Admin -> Dashboard every 5 minutes and watch Launch operator
   signals.
4. Record the first real request outcome.

### HOLD

Use HOLD when launch can plausibly proceed after a bounded mitigation, but one
or more soft gates need active operator handling. Do not open intake yet.

Required actions:

1. Name the blocked gate.
2. Name the owner.
3. Name the mitigation.
4. Set a re-check time no more than 30 minutes away.
5. Re-run the failed or stale validation command before switching to GO.

### NO-GO

Use NO-GO when any hard gate is red, any secret has been exposed, or the
operator cannot verify production state. Do not open intake.

Required actions:

1. Pause intake by pausing the affected service area when applicable.
2. Keep the production database intact for investigation.
3. Record the failed gate and evidence path.
4. Create a new slice or incident follow-up before retrying launch.

## Operator Decision Ledger

Use this ledger as a template for the final decision call. Copy the completed
decision into the NurseConnect Program/Tracker in Notion or a separate launch
evidence artifact; do not edit this repository runbook with per-launch
production evidence.

- Decision: GO / HOLD / NO-GO
- Production URL:
- Deploy identifier:
- Main commit:
- Verify-slice run root:
- Required-gates evidence path:
- PR or CI URL:
- Production deploy evidence URL:
- Operator:
- Rollback owner:
- Pause-intake owner:
- Decision time:
- Re-check time, if HOLD:
- `pnpm gate:release` result:
- `pnpm launch:readiness` result:
- `pnpm launch:rehearsal` result:
- `LAUNCH_MONITOR_ADMIN_COOKIE='<cookie header>' pnpm launch:monitor -- --url https://<production-url> --once`
  result:
- Authenticated first-hour monitor output location:
- `pnpm launch:auth-monitor` result:
- Auth monitor output location:
- `/api/health` result summary:
- `/api/admin/ops/status` result summary:
- Manual rehearsal result:
- Accepted exclusions reviewed: yes / no
- Notes:

## Post-Decision Handoff

After GO:

- Watch first-hour monitor output continuously.
- Keep the admin dashboard visible on Launch operator signals.
- Record the first completed visit and any exceptions.
- Update the NurseConnect Program and tracker in Notion with the PHI-safe
  decision, evidence links, owner, and next action. Do not paste patient
  details, cookies, passwords, raw ops payloads, or screenshots containing PHI.
- If any hard gate turns red after launch opens, switch to HOLD or NO-GO and
  pause intake when needed.

After HOLD:

- Do not open intake.
- Complete mitigation.
- Re-run only the failed/stale checks first, then re-run the full hard gate
  checklist if the mitigation changed production state.
- Update Notion with the PHI-safe HOLD reason, owner, mitigation, and re-check
  time.

After NO-GO:

- Do not retry from memory.
- Create a follow-up slice or incident note with the failed gate, owner, and
  required fix.
- Update Notion with the PHI-safe NO-GO reason, owner, and next action.
- Restart from this runbook after the fix merges and production is redeployed.
