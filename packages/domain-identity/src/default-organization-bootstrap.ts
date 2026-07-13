import { sql } from "drizzle-orm";

import type { TenantTransactionalDatabase } from "@nurseconnect/database";

import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_ORGANIZATION_NAME,
  DEFAULT_ORGANIZATION_SLUG,
} from "./default-tenant-constants";

type DefaultOrganizationRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export class DefaultOrganizationSlugConflictError extends Error {
  constructor(existingOrganizationId: string) {
    super(`Default organization slug "${DEFAULT_ORGANIZATION_SLUG}" already belongs to organization "${existingOrganizationId}", expected "${DEFAULT_ORGANIZATION_ID}".`);
    this.name = "DefaultOrganizationSlugConflictError";
  }
}

export class DefaultOrganizationIdentityConflictError extends Error {
  constructor() {
    super("Default organization identifier exists with non-canonical attributes");
    this.name = "DefaultOrganizationIdentityConflictError";
  }
}

export async function ensureDefaultOrganization(executor: TenantTransactionalDatabase) {
  const before = await selectCanonicalCandidates(executor);
  assertCanonicalCandidates(before);

  if (!before.some((row) => row.id === DEFAULT_ORGANIZATION_ID)) {
    await executor.execute(sql`
      WITH inserted AS (
        INSERT INTO organizations (id, name, slug, status)
        VALUES (${DEFAULT_ORGANIZATION_ID}, ${DEFAULT_ORGANIZATION_NAME}, ${DEFAULT_ORGANIZATION_SLUG}, 'active')
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      )
      INSERT INTO admin_audit_logs (actor_user_id, action, target_entity_type, target_entity_id, details)
      SELECT NULL, 'tenant_bootstrap.organization_seed', 'organization', id,
        jsonb_build_object('source', 'NC-TB-01')
      FROM inserted
    `);
  }

  assertCanonicalCandidates(await selectCanonicalCandidates(executor));
}

async function selectCanonicalCandidates(executor: TenantTransactionalDatabase) {
  return rowsFrom<DefaultOrganizationRow>(await executor.execute(sql`
    SELECT id, name, slug, status
    FROM organizations
    WHERE id = ${DEFAULT_ORGANIZATION_ID}
       OR slug = ${DEFAULT_ORGANIZATION_SLUG}
  `));
}

function assertCanonicalCandidates(rows: DefaultOrganizationRow[]) {
  const slugOwner = rows.find((row) => row.slug === DEFAULT_ORGANIZATION_SLUG);
  if (slugOwner && slugOwner.id !== DEFAULT_ORGANIZATION_ID) {
    throw new DefaultOrganizationSlugConflictError(slugOwner.id);
  }

  const identityOwner = rows.find((row) => row.id === DEFAULT_ORGANIZATION_ID);
  if (identityOwner && !isCanonical(identityOwner)) {
    throw new DefaultOrganizationIdentityConflictError();
  }
}

function isCanonical(row: DefaultOrganizationRow) {
  return row.name === DEFAULT_ORGANIZATION_NAME
    && row.slug === DEFAULT_ORGANIZATION_SLUG
    && row.status === "active";
}

function rowsFrom<Row extends Record<string, unknown>>(
  result: { rows?: Record<string, unknown>[] } | Record<string, unknown>[],
): Row[] {
  return (Array.isArray(result) ? result : result.rows ?? []) as Row[];
}
