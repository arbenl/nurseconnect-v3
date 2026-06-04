# Disaster Recovery Runbook

## Purpose

This runbook defines the Phase 0 disaster recovery baseline for NurseConnect.
It turns backup assumptions, RPO/RTO targets, restore steps, and evidence rules
into an explicit operational contract before tenancy, RLS, outbox, CRM, and
compliance slices widen the production blast radius.

This runbook is not a production SLA by itself. It is the repo-owned baseline
that operators must validate against the actual hosting Postgres provider and
the deployed production environment.

## Scope

In scope:

- Postgres database backup and restore expectations.
- Application redeploy and configuration checks needed after a restore.
- PHI-safe restore-drill evidence requirements.
- GO/HOLD/NO-GO criteria for DR readiness.

Out of scope:

- Runtime code, migrations, schema, auth, tenancy, RLS, outbox, or notification
  behavior changes.
- Production provider configuration changes.
- Restoring production over itself during a drill.
- Recording secrets, database URLs, raw database dumps, patient details,
  clinical details, session cookies, or screenshots containing PHI in git,
  PRs, chat, or public issue trackers.

## Recovery Severity

| Severity | Example | Recovery Mode | Decision Owner |
| --- | --- | --- | --- |
| DR-0 | Broken deploy, app config error, no database loss | Redeploy or rollback app only | Engineering lead |
| DR-1 | Bad migration or data write detected quickly | Pause intake, preserve DB, restore to scratch, decide repair vs point-in-time recovery | Engineering lead + ops owner |
| DR-2 | Primary database unavailable or corrupted | Restore managed backup/PITR to replacement database, redeploy app to replacement URL/connection | Engineering lead + incident owner |
| DR-3 | Provider-region or account-level outage | Execute provider failover or provision replacement stack from last verified backup | Incident owner + executive approver |

Any DR-1 or higher event must keep the affected production database intact for
investigation until an incident owner approves otherwise.

## RPO And RTO Targets

These targets are Phase 0 enterprise-readiness goals. They become production
commitments only after provider backup/PITR evidence is recorded.

| Target | Baseline | Required Evidence |
| --- | --- | --- |
| RPO, daily backups only | 24 hours maximum accepted data loss | Provider backup policy showing daily backup success and retention |
| RPO, PITR enabled | 15 minutes maximum accepted data loss | Provider PITR window, last restorable timestamp, and restore drill result |
| RTO, scratch restore | 4 hours from DR decision to validated scratch database | Restore-drill evidence with timestamps and validation commands |
| RTO, production replacement | 8 hours from DR decision to replacement app connected to restored database | Incident record or production restore evidence |

Do not claim the PITR RPO target until the production provider has PITR enabled
and a drill has restored a timestamped backup into a scratch database.

## Backup Assumptions To Verify

Before launch GO, and after any database provider change, record these facts in
a private PHI-safe evidence artifact:

- Postgres provider and project/environment name.
- Backup type: snapshot, PITR, logical dump, or a combination.
- Backup frequency.
- Backup retention window.
- PITR window and minimum restore granularity, if enabled.
- Whether backups include all schemas, extensions, roles, indexes, sequences,
  and migration metadata.
- Whether restores are in-place, clone-to-new-database, branch/fork based, or
  support both.
- Last successful backup timestamp.
- Last verified restore-drill timestamp.
- Operator who verified the backup posture.

Record provider console URLs only in private evidence stores. Do not commit
console URLs if they expose project identifiers that should remain private.

## Restore Drill Cadence

- Run a scratch restore drill before opening controlled production intake.
- Run a scratch restore drill at least quarterly after launch.
- Run an additional drill after any database provider, region, backup policy,
  migration strategy, or PHI retention/encryption change.
- Run a tabletop DR review after any DR-1 or higher incident.

Use
[`docs/evidence/disaster-recovery/restore-drill-template.md`](../evidence/disaster-recovery/restore-drill-template.md)
as the evidence template. Store completed evidence in a private location unless
it contains only metadata that is safe to publish.

## Scratch Restore Drill

Use a scratch database that contains no real PHI. For production backup drills,
restore from the managed provider into an isolated replacement database or
provider branch. Never overwrite the primary production database during a
drill.

1. Name the drill owner, reviewer, environment, and restore timestamp target.
2. Confirm the source backup or PITR timestamp is available in the provider.
3. Create a scratch restore target with network access restricted to operators
   running the drill.
4. Restore the selected backup or PITR timestamp into the scratch target.
5. Set terminal-local environment variables for the scratch target only.
   Do not paste the database URL into the evidence artifact.
6. Run migration metadata verification against the scratch target:

   ```bash
   DATABASE_URL='<scratch database url>' pnpm db:verify-meta
   ```

7. Run schema validation against the scratch target:

   ```bash
   DATABASE_URL='<scratch database url>' pnpm db:check
   ```

8. If validating an application deploy against the restored scratch target, set
   the deployment environment to the scratch database and run:

   ```bash
   pnpm launch:readiness
   pnpm launch:monitor -- --url https://<scratch-or-preview-url> --once
   ```

9. Confirm no raw PHI, patient details, session tokens, cookies, or database
   URLs appear in terminal logs, screenshots, PRs, or chat.
10. Record the drill result using the evidence template.
11. Destroy or quarantine the scratch database after evidence has been reviewed.

## Local Non-Production Rehearsal

Local rehearsal proves that the repo commands and migration checks can operate
against a clean database. It does not prove production provider backups or PITR.

Use the Docker Postgres service from `docker-compose.yml` or another
non-production Postgres database whose name includes `test`, `ci`, `gate`,
`dev`, `local`, `rehearsal`, or `staging`.

```bash
docker compose up -d postgres
docker exec nurseconnect_postgres psql -U nurseconnect -d postgres \
  -v ON_ERROR_STOP=1 \
  -c "SELECT 'CREATE DATABASE nurseconnect_test' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nurseconnect_test')\\gexec"
DATABASE_URL='postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test' pnpm db:from-clean
DATABASE_URL='postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test' pnpm db:verify-meta
DATABASE_URL='postgresql://nurseconnect:nurseconnect@127.0.0.1:5432/nurseconnect_test' pnpm db:check
```

Record local rehearsal separately from provider restore evidence. A green local
rehearsal is useful, but it is not a substitute for a managed-backup restore.

## Post-Restore Validation

After any scratch or production replacement restore, validate:

- Migration metadata matches the repository head expected for the restored app.
- `/api/health` and `/api/health/db` return healthy responses for the restored
  deployment.
- Admin sign-in and `/api/admin/ping` work with a synthetic or operator admin.
- Launch-critical service-area and nurse-supply signals are visible in
  `/api/admin/ops/status` when the environment is intended for launch.
- No provider credentials, database URLs, session cookies, patient details, or
  clinical details were captured in evidence.

For a production replacement restore, keep intake paused until the incident
owner records GO using the controlled launch execution readiness runbook.

## Evidence Rules

Completed evidence may include:

- Drill date, environment tier, operator, reviewer, and incident/drill ID.
- Source backup type and timestamp.
- Restore target type, without secrets or raw hostnames when private.
- Start/end timestamps and calculated restore duration.
- Command names and pass/fail summaries.
- Sanitized provider backup policy summary.
- Sanitized validation screenshots only when they contain no PHI or secrets.
- Final GO/HOLD/NO-GO decision and owner.

Completed evidence must not include:

- `DATABASE_URL`, `DATABASE_POOL_URL`, passwords, tokens, cookies, or session
  identifiers.
- Raw database dumps or table exports.
- Patient/member/referral/nurse clinical details.
- Screenshots that show PHI, addresses, payment identifiers, or raw admin
  payloads.
- Provider console screenshots with secrets or sensitive project identifiers.

## DR Decision Checklist

Use GO only when all applicable items are true:

- Backup/PITR provider facts are recorded and current.
- The latest scheduled scratch restore drill passed.
- RPO/RTO target and actual drill duration are known.
- Restore validation commands passed or failures have an accepted mitigation.
- Rollback owner, incident owner, and communications owner are named.
- Evidence is PHI-safe and stored in the right location.

Use HOLD when restore evidence is stale, incomplete, or missing provider
attestation but production is not currently impaired.

Use NO-GO for production launch when no backup policy is verified, when no safe
restore target exists, or when a drill exposes unmitigated restore failures.

## Rollback And Pause-Intake

For DR-1 or higher:

1. Pause controlled intake by disabling or pausing affected service areas when
   the application remains reachable.
2. Preserve the production database and logs for investigation.
3. Name the incident owner, restore owner, and communications owner.
4. Restore into scratch first unless the primary database is unavailable and the
   incident owner approves direct replacement.
5. Redeploy the application only after the replacement database has passed
   validation.
6. Record the PHI-safe incident evidence and create a follow-up slice for any
   failed control.

## Open Follow-Ups

- Confirm the actual production Postgres provider backup/PITR policy before
  launch GO.
- Record the first managed-backup scratch restore drill in private evidence.
- Revisit RPO/RTO after NC-E1 tenancy/RLS and NC-E5 compliance decisions,
  because tenant isolation, PHI retention, and encryption may change restore
  requirements.
