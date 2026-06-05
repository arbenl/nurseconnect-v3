import { db, schema, sql, withTenantContext, type TenantQueryExecutor } from "@nurseconnect/database";
import { beforeEach, describe, expect, it } from "vitest";

import {
  listActiveOrganizationMembershipsForUser,
  OrganizationInsufficientRoleError,
  OrganizationMembershipRequiredError,
  requireOrganizationMembership,
} from "./organization-membership";
import {
  bootstrapDefaultOrganizationMemberships,
  DEFAULT_ORGANIZATION_ID,
} from "./organization-membership-bootstrap";

const { orgMemberships, organizations, users } = schema;

const orgA = "11111111-1111-4111-8111-111111111111";
const orgB = "22222222-2222-4222-8222-222222222222";

type UserRole = typeof users.$inferInsert.role;
type MembershipRole = typeof orgMemberships.$inferInsert.role;
type MembershipStatus = typeof orgMemberships.$inferInsert.status;

async function currentTenant(database: TenantQueryExecutor = db) {
  const result = await database.execute(sql`SELECT current_setting('app.current_tenant_id', true) AS tenant_id`);
  const rows = Array.isArray(result) ? result : result.rows ?? [];
  return (rows.at(0)?.tenant_id as string | null | undefined) ?? "";
}

async function insertUser(input: { email: string; role: UserRole }) {
  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      role: input.role,
    })
    .returning();

  if (!user) {
    throw new Error("Expected user insert to return a row");
  }

  return user;
}

async function insertOrganization(input: { id: string; slug: string; status?: typeof organizations.$inferInsert.status }) {
  await db.insert(organizations).values({
    id: input.id,
    name: input.slug,
    slug: input.slug,
    status: input.status ?? "active",
  });
}

async function insertMembership(input: {
  organizationId: string;
  userId: string;
  role: MembershipRole;
  status?: MembershipStatus;
}) {
  return withTenantContext(db, input.organizationId, async (tx) => {
    await tx.execute(sql`
      INSERT INTO org_memberships (
        organization_id,
        user_id,
        role,
        status,
        source,
        activated_at
      )
      VALUES (
        ${input.organizationId},
        ${input.userId},
        ${input.role},
        ${input.status ?? "active"},
        'bootstrap',
        now()
      )
    `);
  });
}

describe("organization membership helpers", () => {
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE "org_memberships", "organizations", "users" RESTART IDENTITY CASCADE`);
  });

  it("lists only the active membership visible through the current tenant context", async () => {
    const user = await insertUser({ email: "tenant-admin@example.test", role: "admin" });
    await insertOrganization({ id: orgA, slug: "org-a" });
    await insertOrganization({ id: orgB, slug: "org-b" });
    await insertMembership({ organizationId: orgA, userId: user.id, role: "owner" });
    await insertMembership({ organizationId: orgB, userId: user.id, role: "admin" });

    const memberships = await withTenantContext(db, orgA, async (tx) => {
      expect(await currentTenant(tx)).toBe(orgA);
      return listActiveOrganizationMembershipsForUser({ userId: user.id }, tx);
    });

    expect(memberships).toEqual([
      {
        organizationId: orgA,
        userId: user.id,
        role: "owner",
        status: "active",
      },
    ]);
  });

  it("fails closed for missing, invited, disabled, suspended-org, and wrong-role memberships", async () => {
    const missingUser = await insertUser({ email: "missing@example.test", role: "admin" });
    const invitedUser = await insertUser({ email: "invited@example.test", role: "admin" });
    const disabledUser = await insertUser({ email: "disabled@example.test", role: "admin" });
    const suspendedUser = await insertUser({ email: "suspended@example.test", role: "admin" });
    const viewerUser = await insertUser({ email: "viewer@example.test", role: "admin" });
    await insertOrganization({ id: orgA, slug: "org-a" });
    await insertOrganization({ id: orgB, slug: "org-b", status: "suspended" });
    await insertMembership({ organizationId: orgA, userId: invitedUser.id, role: "owner", status: "invited" });
    await insertMembership({ organizationId: orgA, userId: disabledUser.id, role: "owner", status: "disabled" });
    await insertMembership({ organizationId: orgB, userId: suspendedUser.id, role: "owner" });
    await insertMembership({ organizationId: orgA, userId: viewerUser.id, role: "viewer" });

    await withTenantContext(db, orgA, async (tx) => {
      await expect(requireOrganizationMembership({ userId: missingUser.id, organizationId: orgA }, tx)).rejects.toThrow(
        OrganizationMembershipRequiredError,
      );
      await expect(requireOrganizationMembership({ userId: invitedUser.id, organizationId: orgA }, tx)).rejects.toThrow(
        OrganizationMembershipRequiredError,
      );
      await expect(requireOrganizationMembership({ userId: disabledUser.id, organizationId: orgA }, tx)).rejects.toThrow(
        OrganizationMembershipRequiredError,
      );
      await expect(
        requireOrganizationMembership({ userId: viewerUser.id, organizationId: orgA, roles: ["owner"] }, tx),
      ).rejects.toThrow(OrganizationInsufficientRoleError);
    });

    await withTenantContext(db, orgB, async (tx) => {
      await expect(requireOrganizationMembership({ userId: suspendedUser.id, organizationId: orgB }, tx)).rejects.toThrow(
        OrganizationMembershipRequiredError,
      );
    });
  });

  it("denies cross-tenant membership checks and unset tenant context", async () => {
    const user = await insertUser({ email: "cross-tenant@example.test", role: "admin" });
    await insertOrganization({ id: orgA, slug: "org-a" });
    await insertOrganization({ id: orgB, slug: "org-b" });
    await insertMembership({ organizationId: orgA, userId: user.id, role: "owner" });

    await withTenantContext(db, orgB, async (tx) => {
      await expect(requireOrganizationMembership({ userId: user.id, organizationId: orgA }, tx)).rejects.toThrow(
        OrganizationMembershipRequiredError,
      );
      expect(await listActiveOrganizationMembershipsForUser({ userId: user.id }, tx)).toEqual([]);
    });

    expect(await currentTenant()).toBe("");
    expect(await listActiveOrganizationMembershipsForUser({ userId: user.id }, db)).toEqual([]);
    await expect(requireOrganizationMembership({ userId: user.id, organizationId: orgA }, db)).rejects.toThrow(
      OrganizationMembershipRequiredError,
    );
  });

  it("rejects duplicate current membership rows", async () => {
    const user = await insertUser({ email: "duplicate@example.test", role: "admin" });
    await insertOrganization({ id: orgA, slug: "org-a" });
    await insertMembership({ organizationId: orgA, userId: user.id, role: "owner" });

    await expect(insertMembership({ organizationId: orgA, userId: user.id, role: "admin" })).rejects.toThrow();
  });

  it("bootstraps the default organization idempotently for global admins only", async () => {
    const admin = await insertUser({ email: "admin@example.test", role: "admin" });
    const referralPartner = await insertUser({ email: "partner@example.test", role: "referral_partner" });
    const patient = await insertUser({ email: "patient@example.test", role: "patient" });
    const nurse = await insertUser({ email: "nurse@example.test", role: "nurse" });

    const first = await bootstrapDefaultOrganizationMemberships();
    const second = await bootstrapDefaultOrganizationMemberships();

    expect(first.organizationId).toBe(DEFAULT_ORGANIZATION_ID);
    expect(second.organizationId).toBe(DEFAULT_ORGANIZATION_ID);

    const rows = await withTenantContext(db, DEFAULT_ORGANIZATION_ID, async (tx) => {
      const result = await tx.execute(sql`
        SELECT user_id, role, status, source, activated_at IS NOT NULL AS has_activated_at
        FROM org_memberships
        WHERE organization_id = ${DEFAULT_ORGANIZATION_ID}
      `);
      return Array.isArray(result) ? result : result.rows ?? [];
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.user_id).toBe(admin.id);
    expect(rows[0]?.role).toBe("owner");
    expect(rows[0]?.status).toBe("active");
    expect(rows[0]?.source).toBe("bootstrap");
    expect(rows[0]?.has_activated_at).toBe(true);

    await withTenantContext(db, DEFAULT_ORGANIZATION_ID, async (tx) => {
      await expect(
        requireOrganizationMembership({ userId: admin.id, organizationId: DEFAULT_ORGANIZATION_ID, roles: ["owner"] }, tx),
      ).resolves.toMatchObject({ userId: admin.id, role: "owner", status: "active" });
      await expect(
        requireOrganizationMembership({ userId: referralPartner.id, organizationId: DEFAULT_ORGANIZATION_ID }, tx),
      ).rejects.toThrow(OrganizationMembershipRequiredError);
      await expect(
        requireOrganizationMembership({ userId: patient.id, organizationId: DEFAULT_ORGANIZATION_ID }, tx),
      ).rejects.toThrow(OrganizationMembershipRequiredError);
      await expect(
        requireOrganizationMembership({ userId: nurse.id, organizationId: DEFAULT_ORGANIZATION_ID }, tx),
      ).rejects.toThrow(OrganizationMembershipRequiredError);
    });
  });
});
