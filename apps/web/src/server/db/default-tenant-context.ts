import type { DbTransaction, TenantBoundary } from "@nurseconnect/database";
import { DEFAULT_ORGANIZATION_ID } from "@nurseconnect/domain-identity/default-tenant-constants";

export function withDefaultTenantContext<T>(
  boundary: Exclude<TenantBoundary, "unspecified">,
  callback: (tx: DbTransaction) => Promise<T>,
): Promise<T> {
  return import("@nurseconnect/database").then(({ db, withTenantContext }) => withTenantContext(
    db,
    DEFAULT_ORGANIZATION_ID,
    (tx) => callback(tx as DbTransaction),
    boundary,
  ));
}

export type { DbTransaction as TenantTransaction };
