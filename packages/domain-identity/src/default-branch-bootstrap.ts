import { sql } from "drizzle-orm";

import type { TenantTransactionalDatabase } from "@nurseconnect/database";

import { DEFAULT_ORGANIZATION_ID } from "./default-tenant-constants";

export const DEFAULT_BRANCH_ID = "00000000-0000-4000-8000-000000000101";
export const DEFAULT_BRANCH_SLUG = "nurseconnect-default-branch";
export const DEFAULT_BRANCH_NAME = "NurseConnect Default Branch";
export const DEFAULT_BRANCH_JURISDICTION_COUNTRY = "XK";
export const DEFAULT_BRANCH_JURISDICTION_REGION = "Pristina";

type DefaultBranchRow = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  status: string;
  jurisdiction_country: string;
  jurisdiction_region: string;
};

export class DefaultBranchSlugConflictError extends Error {
  constructor(existingBranchId: string) {
    super(`Default branch slug "${DEFAULT_BRANCH_SLUG}" already belongs to branch "${existingBranchId}", expected "${DEFAULT_BRANCH_ID}".`);
    this.name = "DefaultBranchSlugConflictError";
  }
}

export class DefaultBranchIdentityConflictError extends Error {
  constructor() {
    super("Default branch identifier exists with non-canonical ownership or attributes");
    this.name = "DefaultBranchIdentityConflictError";
  }
}

export async function ensureDefaultBranch(executor: TenantTransactionalDatabase) {
  const before = await selectCanonicalCandidates(executor);
  assertCanonicalCandidates(before);

  if (!before.some((row) => row.id === DEFAULT_BRANCH_ID)) {
    await executor.execute(sql`
      WITH inserted AS (
        INSERT INTO branches (id, organization_id, name, slug, status, jurisdiction_country, jurisdiction_region)
        VALUES (${DEFAULT_BRANCH_ID}, ${DEFAULT_ORGANIZATION_ID}, ${DEFAULT_BRANCH_NAME}, ${DEFAULT_BRANCH_SLUG},
          'active', ${DEFAULT_BRANCH_JURISDICTION_COUNTRY}, ${DEFAULT_BRANCH_JURISDICTION_REGION})
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      )
      INSERT INTO admin_audit_logs (actor_user_id, action, target_entity_type, target_entity_id, details)
      SELECT NULL, 'tenant_bootstrap.branch_seed', 'branch', id,
        jsonb_build_object('source', 'NC-TB-01', 'organization_id', ${DEFAULT_ORGANIZATION_ID})
      FROM inserted
    `);
  }

  assertCanonicalCandidates(await selectCanonicalCandidates(executor));
}

async function selectCanonicalCandidates(executor: TenantTransactionalDatabase) {
  return rowsFrom<DefaultBranchRow>(await executor.execute(sql`
    SELECT id, organization_id, name, slug, status, jurisdiction_country, jurisdiction_region
    FROM branches
    WHERE id = ${DEFAULT_BRANCH_ID}
       OR (organization_id = ${DEFAULT_ORGANIZATION_ID} AND slug = ${DEFAULT_BRANCH_SLUG})
  `));
}

function assertCanonicalCandidates(rows: DefaultBranchRow[]) {
  const slugOwner = rows.find((row) =>
    row.organization_id === DEFAULT_ORGANIZATION_ID && row.slug === DEFAULT_BRANCH_SLUG
  );
  if (slugOwner && slugOwner.id !== DEFAULT_BRANCH_ID) {
    throw new DefaultBranchSlugConflictError(slugOwner.id);
  }

  const identityOwner = rows.find((row) => row.id === DEFAULT_BRANCH_ID);
  if (identityOwner && !isCanonical(identityOwner)) {
    throw new DefaultBranchIdentityConflictError();
  }
}

function isCanonical(row: DefaultBranchRow) {
  return row.organization_id === DEFAULT_ORGANIZATION_ID
    && row.name === DEFAULT_BRANCH_NAME
    && row.slug === DEFAULT_BRANCH_SLUG
    && row.status === "active"
    && row.jurisdiction_country === DEFAULT_BRANCH_JURISDICTION_COUNTRY
    && row.jurisdiction_region === DEFAULT_BRANCH_JURISDICTION_REGION;
}

function rowsFrom<Row extends Record<string, unknown>>(
  result: { rows?: Record<string, unknown>[] } | Record<string, unknown>[],
): Row[] {
  return (Array.isArray(result) ? result : result.rows ?? []) as Row[];
}
