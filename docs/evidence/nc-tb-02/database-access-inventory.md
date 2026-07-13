# NC-TB-02 Database Access Inventory

This PHI-safe inventory defines what the application observer covers and what
must remain separately controlled before NC-TB-03 enforcement. It contains no
SQL values, tenant identifiers, credentials, or production evidence.

| Access path | Classification | NC-TB-02 evidence / control |
|---|---|---|
| Exported Drizzle `db` used by web/domain runtime | tenant-scoped when it reaches tracked tables | logger classification plus transaction-provenance facade; Playwright zero receipt |
| Explicit transaction handles passed to domain helpers | tenant-scoped | `withTenantContext` sets and asserts transaction-local GUC; global-handle misuse is counted |
| Authentication and platform identity queries | platform-scoped | excluded unless the same query reaches a tracked table |
| Nurse supply, location, service-area, referral-profile, and audit queries | platform/deferred scope | NC-TB-01 ownership decisions retained; mixed queries touching tracked tables are observed |
| Payment authorization and payout admin runtime | tenant-scoped | request-owned context and one tenant transaction; payout/export policy still gates NC-TB-03 |
| Drizzle migrations and schema generation | migration-only | reviewed migration workflow; never counted as representative runtime telemetry |
| NC-TB-01 ownership backfill/reconciliation | retired migration path | retained only for rollback/rehearsal; explicit default ownership and sanitized evidence |
| Seed/bootstrap scripts | local/controlled bootstrap | deterministic default identifiers; branch/membership runtime bootstrap now uses tenant context |
| Playwright direct `pg` fixtures | test-only | setup/assertion path, excluded from application signal; application web-server queries remain observed |
| DB integration fixtures and disposable test clients | test-only | isolated database evidence; not production coverage |
| Support SQL / ad-hoc operator access | blocked pending runbook | no approved production tenant-table path; must be classified before NC-TB-03 |
| Analytics/export pipelines | blocked/absent | no approved production pipeline; explicit tenant/export decision required before enforcement |
| Scheduled jobs/workers | absent pending outbox band | future jobs must receive tenant context and their own observation proof |
| `nurseconnect_qa` evidence tooling | platform review tooling | read-only evidence route; not a substitute for runtime observation |

## NC-TB-03 Hold

E2E zero closes NC-TB-02 only. Enforcement remains held until a representative
14-day zero window is recorded, restrictive staging and two-tenant proofs pass,
and support, analytics/export, and payout classifications are approved.
