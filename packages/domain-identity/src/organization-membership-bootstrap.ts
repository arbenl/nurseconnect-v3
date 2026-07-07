import { sql } from "drizzle-orm";

import type { TenantTransactionalDatabase } from "@nurseconnect/database";

export const DEFAULT_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";
export const DEFAULT_ORGANIZATION_SLUG = "nurseconnect-default";
export const DEFAULT_ORGANIZATION_NAME = "NurseConnect Default Organization";
export const DEFAULT_BRANCH_ID = "00000000-0000-4000-8000-000000000101";
export const DEFAULT_BRANCH_SLUG = "nurseconnect-default-branch";
export const DEFAULT_BRANCH_NAME = "NurseConnect Default Branch";
export const DEFAULT_BRANCH_JURISDICTION_COUNTRY = "US";
export const DEFAULT_BRANCH_JURISDICTION_REGION = "default-launch-region";

type BootstrapRow = {
  organization_id: string;
  membership_user_id: string | null;
};

type DefaultOrganizationSlugRow = {
  id: string;
};

export class DefaultOrganizationSlugConflictError extends Error {
  constructor(existingOrganizationId: string) {
    super(`Default organization slug "${DEFAULT_ORGANIZATION_SLUG}" already belongs to organization "${existingOrganizationId}", expected "${DEFAULT_ORGANIZATION_ID}".`);
    this.name = "DefaultOrganizationSlugConflictError";
  }
}

export class DefaultBranchSlugConflictError extends Error {
  constructor(existingBranchId: string) {
    super(`Default branch slug "${DEFAULT_BRANCH_SLUG}" already belongs to branch "${existingBranchId}", expected "${DEFAULT_BRANCH_ID}".`);
    this.name = "DefaultBranchSlugConflictError";
  }
}

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

async function ensureDefaultOrganization(executor: TenantTransactionalDatabase) {
  const slugOwner = rowsFrom<DefaultOrganizationSlugRow>(
    await executor.execute(sql`
      SELECT id
      FROM organizations
      WHERE slug = ${DEFAULT_ORGANIZATION_SLUG}
      LIMIT 1
    `),
  ).at(0);

  if (slugOwner && slugOwner.id !== DEFAULT_ORGANIZATION_ID) {
    throw new DefaultOrganizationSlugConflictError(slugOwner.id);
  }

  await executor.execute(sql`
    INSERT INTO organizations (id, name, slug, status)
    VALUES (${DEFAULT_ORGANIZATION_ID}, ${DEFAULT_ORGANIZATION_NAME}, ${DEFAULT_ORGANIZATION_SLUG}, 'active')
    ON CONFLICT (id) DO NOTHING
  `);
}

async function ensureDefaultBranch(executor: TenantTransactionalDatabase) {
  const slugOwner = rowsFrom<DefaultOrganizationSlugRow>(
    await executor.execute(sql`
      SELECT id FROM branches
      WHERE organization_id = ${DEFAULT_ORGANIZATION_ID} AND slug = ${DEFAULT_BRANCH_SLUG}
      LIMIT 1
    `),
  ).at(0);

  if (slugOwner && slugOwner.id !== DEFAULT_BRANCH_ID) {
    throw new DefaultBranchSlugConflictError(slugOwner.id);
  }

  await executor.execute(sql`
    INSERT INTO branches (id, organization_id, name, slug, status, jurisdiction_country, jurisdiction_region)
    VALUES (${DEFAULT_BRANCH_ID}, ${DEFAULT_ORGANIZATION_ID}, ${DEFAULT_BRANCH_NAME}, ${DEFAULT_BRANCH_SLUG},
      'active', ${DEFAULT_BRANCH_JURISDICTION_COUNTRY}, ${DEFAULT_BRANCH_JURISDICTION_REGION})
    ON CONFLICT (id) DO NOTHING
  `);
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
