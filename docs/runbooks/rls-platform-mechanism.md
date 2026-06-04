# RLS Platform Mechanism

`NC-E1-02` adds the repo-owned mechanism for tenant-scoped database execution. It does not enable production RLS policies or add tenant columns.

## Tenant Context

Use `withTenantContext(database, organizationId, callback)` for tenant-owned queries once later slices wire callsites into RLS. The caller must pass the selected database handle. The helper must not import the global `db` internally because future multi-country deployments need a routing layer to choose the correct regional database before setting tenant context.

The helper sets `app.current_tenant_id` transaction-locally with PostgreSQL `set_config(..., true)`, verifies it before user code runs, and rejects nested tenant contexts. The third argument, `true`, is load-bearing: it means the GUC is local to the current transaction and should clear after commit or rollback. Errors are sanitized and must not include tenant IDs, PHI, raw query text, or GUC values.

## Role Assertion

Use `assertRlsConnectionRoleReady(database)` at application startup or in CI/health verification, not on every request. It checks the current PostgreSQL role in `pg_roles` and fails closed when the role is superuser or can bypass RLS.

Local tooling that intentionally connects with an unsafe development role must opt in with `allowUnsafeLocalRole: true`. Production-like startup code must not pass that option.

## Pooling And Residency Notes

The mechanism relies on transaction-local PostgreSQL GUC state. Deployments using PgBouncer or another pooler must verify transaction boundaries and cleanup with the slice tests before enabling RLS-backed tenant isolation. Pooling must either preserve transaction boundaries correctly or reset session state before connection reuse.

Nested tenant detection is enforced in the JavaScript call chain with `AsyncLocalStorage`; it prevents accidental nested `withTenantContext` calls in one async flow. It is not a substitute for PostgreSQL transaction isolation or pooler reset behavior.

Legal jurisdiction remains a compliance and operating scope, not the tenant key. The tenant key is the owning `organization_id`; regional routing and data-residency topology are separate architecture decisions before multi-country production.

## Non-Scope

This mechanism does not create organizations, branches, facilities, memberships, jurisdiction tables, production RLS policies, PHI read auditing, encryption, consent, retention, BAA/DPA controls, or default tenant backfill.
