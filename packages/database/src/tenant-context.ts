import { AsyncLocalStorage } from "node:async_hooks";

import { sql, type SQL } from "drizzle-orm";

export type OrganizationId = string & { readonly __organizationId: unique symbol };

type QueryResult<Row extends Record<string, unknown>> = { rows?: Row[] } | Row[];

export type TenantQueryExecutor = {
  execute(query: SQL): Promise<QueryResult<Record<string, unknown>>>;
};

export type TenantTransactionalDatabase<Tx extends TenantQueryExecutor = TenantQueryExecutor> = TenantQueryExecutor & {
  transaction<T>(callback: (tx: Tx) => Promise<T>): Promise<T>;
};

const organizationIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TenantBoundary =
  | "admin.active-queue"
  | "admin.activity"
  | "admin.dashboard"
  | "admin.exception-queue"
  | "admin.ops-status"
  | "admin.request-detail"
  | "organization.membership"
  | "nurse.availability"
  | "payment.admin"
  | "referral.request"
  | "request.action"
  | "request.create"
  | "request.reassign"
  | "request.triage"
  | "unspecified"
  | "visit.notifications"
  | "visit.projection"
  | "visit.timeline";

type TenantObservationContext = {
  boundary: TenantBoundary;
  organizationId: OrganizationId;
};

const globalForTenantContext = globalThis as unknown as {
  __tenantContextStore?: AsyncLocalStorage<TenantObservationContext>;
};
const tenantContextStore = globalForTenantContext.__tenantContextStore
  ?? new AsyncLocalStorage<TenantObservationContext>();
globalForTenantContext.__tenantContextStore = tenantContextStore;

export class TenantContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantContextError";
  }
}

export function toOrganizationId(value: string): OrganizationId {
  if (!organizationIdPattern.test(value)) {
    throw new TenantContextError("Invalid organization identifier");
  }

  return value as OrganizationId;
}

export async function withTenantContext<T, Tx extends TenantQueryExecutor = TenantQueryExecutor>(
  database: TenantTransactionalDatabase<Tx>,
  organizationId: string,
  callback: (tx: Tx, organizationId: OrganizationId) => Promise<T>,
  boundary: TenantBoundary = "unspecified",
): Promise<T> {
  const parsedOrganizationId = toOrganizationId(organizationId);

  if (tenantContextStore.getStore() !== undefined) {
    throw new TenantContextError("Tenant context already active");
  }

  return database.transaction((tx) =>
    tenantContextStore.run({
      boundary,
      organizationId: parsedOrganizationId,
    }, async () => {
      await tx.execute(sql`SELECT set_config('app.current_tenant_id', ${parsedOrganizationId}, true)`);
      await assertTenantContext(tx, parsedOrganizationId);
      return callback(tx, parsedOrganizationId);
    }),
  );
}

export function getTenantObservationContext(): TenantObservationContext | undefined {
  return tenantContextStore.getStore();
}

export async function assertTenantContext(
  database: TenantQueryExecutor,
  expectedOrganizationId?: string,
): Promise<void> {
  const parsedExpected =
    expectedOrganizationId === undefined ? undefined : toOrganizationId(expectedOrganizationId);

  const result =
    parsedExpected === undefined
      ? await database.execute(sql`
          SELECT COALESCE(current_setting('app.current_tenant_id', true), '') <> '' AS tenant_context_ready
        `)
      : await database.execute(sql`
          SELECT COALESCE(current_setting('app.current_tenant_id', true), '') = ${parsedExpected}
            AS tenant_context_ready
        `);

  const [{ tenant_context_ready: ready } = { tenant_context_ready: false }] = rowsFrom(result) as Array<{
    tenant_context_ready: boolean;
  }>;

  if (!ready) {
    throw new TenantContextError(
      parsedExpected === undefined ? "Tenant context is not set" : "Tenant context mismatch",
    );
  }
}

function rowsFrom<Row extends Record<string, unknown>>(result: QueryResult<Row>): Row[] {
  return Array.isArray(result) ? result : result.rows ?? [];
}
