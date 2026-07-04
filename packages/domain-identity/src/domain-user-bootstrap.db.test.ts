import { db, eq, schema, sql, withTenantContext } from "@nurseconnect/database";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ensureDomainUserFromSession, maybeBootstrapFirstAdmin } from "./domain-user";
import { DEFAULT_ORGANIZATION_ID } from "./organization-membership-bootstrap";

const { authUsers, orgMemberships, users } = schema;

describe("first admin organization bootstrap", () => {
  let originalEnv: string | undefined;

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE "auth_users", "org_memberships", "organizations", "users" RESTART IDENTITY CASCADE`);
    originalEnv = process.env.FIRST_ADMIN_EMAILS;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.FIRST_ADMIN_EMAILS;
    else process.env.FIRST_ADMIN_EMAILS = originalEnv;
  });

  it("grants default organization membership when allowlist promotes an admin", async () => {
    process.env.FIRST_ADMIN_EMAILS = "launch.admin@test.local";
    await db.insert(authUsers).values({
      id: "auth_launch_admin",
      email: "launch.admin@test.local",
      emailVerified: true,
    });

    const domainUser = await ensureDomainUserFromSession({
      id: "auth_launch_admin",
      email: "launch.admin@test.local",
      name: "Launch Admin",
    });
    const promoted = await maybeBootstrapFirstAdmin(domainUser!);

    expect(promoted?.role).toBe("admin");
    await withTenantContext(db, DEFAULT_ORGANIZATION_ID, async (tx) => {
      const [membership] = await tx
        .select()
        .from(orgMemberships)
        .where(eq(orgMemberships.userId, promoted!.id));
      expect(membership).toMatchObject({
        organizationId: DEFAULT_ORGANIZATION_ID,
        role: "owner",
        status: "active",
        source: "bootstrap",
      });
    });
  });

  it("backfills default membership for an existing admin on session sync", async () => {
    const [admin] = await db
      .insert(users)
      .values({ email: "existing.admin@test.local", role: "admin" })
      .returning();

    await maybeBootstrapFirstAdmin(admin!);

    await withTenantContext(db, DEFAULT_ORGANIZATION_ID, async (tx) => {
      const [membership] = await tx
        .select()
        .from(orgMemberships)
        .where(eq(orgMemberships.userId, admin!.id));
      expect(membership?.organizationId).toBe(DEFAULT_ORGANIZATION_ID);
      expect(membership?.status).toBe("active");
    });
  });

  it("does not reactivate an intentionally disabled admin membership", async () => {
    const [admin] = await db
      .insert(users)
      .values({ email: "disabled.admin@test.local", role: "admin" })
      .returning();
    await db.execute(sql`
      INSERT INTO organizations (id, name, slug, status)
      VALUES (${DEFAULT_ORGANIZATION_ID}, 'NurseConnect Default Organization', 'nurseconnect-default', 'active')
    `);
    await db.insert(orgMemberships).values({
      organizationId: DEFAULT_ORGANIZATION_ID,
      userId: admin!.id,
      role: "viewer",
      status: "disabled",
      source: "bootstrap",
    });

    await maybeBootstrapFirstAdmin(admin!);

    await withTenantContext(db, DEFAULT_ORGANIZATION_ID, async (tx) => {
      const [membership] = await tx
        .select()
        .from(orgMemberships)
        .where(eq(orgMemberships.userId, admin!.id));
      expect(membership).toMatchObject({ role: "viewer", status: "disabled" });
    });
  });
});
