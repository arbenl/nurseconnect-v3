import { db, sql } from "@nurseconnect/database";
import { beforeEach, describe, expect, it } from "vitest";

import {
  bootstrapDefaultOrganizationMemberships,
  DEFAULT_BRANCH_ID,
  DEFAULT_BRANCH_JURISDICTION_COUNTRY,
  DEFAULT_BRANCH_JURISDICTION_REGION,
  DEFAULT_BRANCH_SLUG,
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_ORGANIZATION_SLUG,
  DefaultBranchSlugConflictError,
} from "./organization-membership-bootstrap";

const conflictingBranchId = "11111111-1111-4111-8111-111111111111";

function rowsFrom(result: { rows?: Record<string, unknown>[] } | Record<string, unknown>[]) {
  return Array.isArray(result) ? result : result.rows ?? [];
}

describe("default branch bootstrap", () => {
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE "org_memberships", "branches", "organizations", "users" RESTART IDENTITY CASCADE`);
  });

  it("seeds the default branch idempotently with jurisdiction", async () => {
    const first = await bootstrapDefaultOrganizationMemberships();
    const second = await bootstrapDefaultOrganizationMemberships();

    expect(first.branchId).toBe(DEFAULT_BRANCH_ID);
    expect(second.branchId).toBe(DEFAULT_BRANCH_ID);

    const result = await db.execute(sql`
      SELECT id, organization_id, slug, jurisdiction_country, jurisdiction_region
      FROM branches
      WHERE id = ${DEFAULT_BRANCH_ID}
    `);

    expect(rowsFrom(result)).toEqual([
      {
        id: DEFAULT_BRANCH_ID,
        organization_id: DEFAULT_ORGANIZATION_ID,
        slug: DEFAULT_BRANCH_SLUG,
        jurisdiction_country: DEFAULT_BRANCH_JURISDICTION_COUNTRY,
        jurisdiction_region: DEFAULT_BRANCH_JURISDICTION_REGION,
      },
    ]);
  });

  it("fails when the default branch slug belongs to another branch", async () => {
    await db.execute(sql`
      INSERT INTO organizations (id, name, slug, status)
      VALUES (${DEFAULT_ORGANIZATION_ID}, 'Default Org', ${DEFAULT_ORGANIZATION_SLUG}, 'active')
    `);
    await db.execute(sql`
      INSERT INTO branches (
        id,
        organization_id,
        name,
        slug,
        status,
        jurisdiction_country,
        jurisdiction_region
      )
      VALUES (
        ${conflictingBranchId},
        ${DEFAULT_ORGANIZATION_ID},
        'Conflicting Branch',
        ${DEFAULT_BRANCH_SLUG},
        'active',
        ${DEFAULT_BRANCH_JURISDICTION_COUNTRY},
        ${DEFAULT_BRANCH_JURISDICTION_REGION}
      )
    `);

    await expect(bootstrapDefaultOrganizationMemberships()).rejects.toThrow(DefaultBranchSlugConflictError);
  });
});
