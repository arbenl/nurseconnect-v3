# Restore Drill Evidence Template

Copy this template into a private evidence store for each restore drill. Keep
completed evidence PHI-safe. Do not commit completed production evidence unless
it contains only metadata that is safe to publish.

## Drill Metadata

- Drill ID:
- Date:
- Environment tier: local / staging / production-backup-to-scratch
- Source environment:
- Restore target:
- Operator:
- Reviewer:
- Current `main` commit:
- Related PR or incident:

## Backup Source

- Backup type: snapshot / PITR / logical dump / provider branch
- Source backup timestamp:
- Provider retention window:
- PITR window, if applicable:
- Provider backup policy verified: yes / no
- Provider backup policy evidence location:

Do not paste provider console URLs, database URLs, secrets, or screenshots that
expose sensitive project identifiers unless the evidence store is private and
approved for that data.

## Timing

- DR decision time:
- Restore started:
- Restore completed:
- Validation started:
- Validation completed:
- Calculated restore duration:
- RPO observed:
- RTO observed:

## Validation Results

| Check | Result | Evidence Location |
| --- | --- | --- |
| Restore target created without overwriting production | pending | |
| Migration metadata check, `pnpm db:verify-meta` | pending | |
| Schema check, `pnpm db:check` | pending | |
| `/api/health` or equivalent deployment health | pending | |
| `/api/health/db` or equivalent DB health | pending | |
| Admin synthetic sign-in or `/api/admin/ping`, when applicable | pending | |
| Launch/admin ops status, when applicable | pending | |
| Evidence redaction review | pending | |

## Result

- Decision: GO / HOLD / NO-GO
- Accepted data-loss window:
- Accepted downtime window:
- Follow-up owner:
- Follow-up due date:
- Notes:

## Redaction Checklist

- [ ] No `DATABASE_URL`, `DATABASE_POOL_URL`, passwords, tokens, cookies, or
      session identifiers.
- [ ] No raw database dumps, table exports, or provider credentials.
- [ ] No patient/member/referral/nurse clinical details.
- [ ] No screenshots containing PHI, addresses, payment identifiers, or raw
      admin payloads.
- [ ] No provider console screenshot with sensitive project identifiers unless
      stored privately.
