import { sql } from "drizzle-orm";

import type { TenantTransactionalDatabase } from "@nurseconnect/database";

import {
  DEFAULT_BRANCH_ID,
  ensureDefaultBranch,
} from "./default-branch-bootstrap";
import { ensureDefaultOrganization } from "./default-organization-bootstrap";
import {
  DEFAULT_ORGANIZATION_ID,
} from "./default-tenant-constants";

export {
  DEFAULT_BRANCH_ID,
  DEFAULT_BRANCH_JURISDICTION_COUNTRY,
  DEFAULT_BRANCH_JURISDICTION_REGION,
  DEFAULT_BRANCH_NAME,
  DEFAULT_BRANCH_SLUG,
  DefaultBranchIdentityConflictError,
  DefaultBranchSlugConflictError,
} from "./default-branch-bootstrap";
export {
  DefaultOrganizationIdentityConflictError,
  DefaultOrganizationSlugConflictError,
} from "./default-organization-bootstrap";
export {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_ORGANIZATION_NAME,
  DEFAULT_ORGANIZATION_SLUG,
} from "./default-tenant-constants";


type BootstrapRow = {
  organization_id: string;
  membership_user_id: string | null;
};

export async function bootstrapDefaultOrganizationMemberships(
  database?: TenantTransactionalDatabase,
): Promise<{ organizationId: string; branchId: string; grantedMemberships: number }> {
  const executor = database ?? (await defaultDatabase());
  await ensureDefaultOrganization(executor);
  await ensureDefaultBranch(executor);

  return membershipResult(await grantDefaultOrganizationMemberships(executor));
}

export async function bootstrapDefaultOrganizationMembershipForAdmin(
  userId: string,
  database?: TenantTransactionalDatabase,
): Promise<{ organizationId: string; branchId: string; grantedMemberships: number }> {
  const executor = database ?? (await defaultDatabase());
  await ensureDefaultOrganization(executor);
  await ensureDefaultBranch(executor);

  return membershipResult(await grantDefaultOrganizationMemberships(executor, userId));
}

async function grantDefaultOrganizationMemberships(
  executor: TenantTransactionalDatabase,
  userId?: string,
) {
  return executor.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_tenant_id', ${DEFAULT_ORGANIZATION_ID}, true)`);
    return tx.execute(sql`
      INSERT INTO org_memberships (organization_id, user_id, role, status, source, activated_at)
      SELECT ${DEFAULT_ORGANIZATION_ID}, users.id, 'owner', 'active', 'bootstrap', now()
      FROM users
      WHERE users.role = 'admin'
      ${userId ? sql`AND users.id = ${userId}` : sql``}
      ON CONFLICT (organization_id, user_id) DO NOTHING
      RETURNING organization_id, user_id AS membership_user_id
    `);
  });
}

function membershipResult(result: { rows?: Record<string, unknown>[] } | Record<string, unknown>[]) {
  return {
    organizationId: DEFAULT_ORGANIZATION_ID,
    branchId: DEFAULT_BRANCH_ID,
    grantedMemberships: rowsFrom<BootstrapRow>(result).filter((row) => row.membership_user_id != null).length,
  };
}

function rowsFrom<Row extends Record<string, unknown>>(
  result: { rows?: Record<string, unknown>[] } | Record<string, unknown>[],
): Row[] {
  return (Array.isArray(result) ? result : result.rows ?? []) as Row[];
}

async function defaultDatabase(): Promise<TenantTransactionalDatabase> {
  const database = await import("@nurseconnect/database");
  return database.db;
}
