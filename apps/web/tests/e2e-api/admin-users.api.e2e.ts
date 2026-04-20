import { expect, test } from "@playwright/test";

import { getDbClient, resetDb } from "../e2e-utils/db";
import { createTestUser, loginTestUser } from "../e2e-utils/helpers";

async function countRoleChangeAuditRows(targetUserId: string) {
  const client = getDbClient();
  await client.connect();

  try {
    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM admin_audit_logs
        WHERE action = 'user.role.changed'
          AND target_entity_id = $1`,
      [targetUserId],
    );

    return Number(result.rows[0]?.count ?? "0");
  } finally {
    await client.end();
  }
}

async function getReferralPartnerRow(userId: string) {
  const client = getDbClient();
  await client.connect();

  try {
    const result = await client.query<{
      user_id: string;
      organization_name: string;
      status: "active" | "inactive";
    }>(
      `SELECT user_id, organization_name, status
         FROM referral_partners
        WHERE user_id = $1`,
      [userId],
    );

    return result.rows[0] ?? null;
  } finally {
    await client.end();
  }
}

test.describe("Admin User Role API", () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test("admin can change a user's role and the audit row is written", async ({ request }) => {
    const adminEmail = `admin-role-${Date.now()}@test.local`;
    await createTestUser(request, adminEmail, "Role Admin", "admin");

    const targetEmail = `patient-role-${Date.now()}@test.local`;
    const { userId: targetUserId } = await createTestUser(request, targetEmail, "Role Patient", "patient");

    await loginTestUser(request, adminEmail);

    const response = await request.post(`/api/admin/users/${targetUserId}/role`, {
      data: { role: "nurse" },
    });
    expect(response.ok(), `Role change failed: ${await response.text()}`).toBeTruthy();
    await expect(response.json()).resolves.toMatchObject({ ok: true });

    const client = getDbClient();
    await client.connect();
    try {
      const userResult = await client.query<{ role: "admin" | "patient" | "nurse" }>(
        "SELECT role FROM users WHERE id = $1",
        [targetUserId],
      );
      expect(userResult.rows[0]?.role).toBe("nurse");
    } finally {
      await client.end();
    }

    expect(await countRoleChangeAuditRows(targetUserId)).toBe(1);
  });

  test("admin can promote an existing user to referral partner", async ({ request }) => {
    const adminEmail = `admin-role-partner-${Date.now()}@test.local`;
    await createTestUser(request, adminEmail, "Role Admin", "admin");

    const targetEmail = `partner-role-${Date.now()}@test.local`;
    const { userId: targetUserId } = await createTestUser(
      request,
      targetEmail,
      "Role Target",
      "patient",
    );

    await loginTestUser(request, adminEmail);

    const response = await request.post(`/api/admin/users/${targetUserId}/role`, {
      data: { role: "referral_partner" },
    });
    expect(response.ok(), `Partner role change failed: ${await response.text()}`).toBeTruthy();
    await expect(response.json()).resolves.toMatchObject({ ok: true });

    const client = getDbClient();
    await client.connect();
    try {
      const userResult = await client.query<{
        role: "admin" | "patient" | "nurse" | "referral_partner";
      }>("SELECT role FROM users WHERE id = $1", [targetUserId]);
      expect(userResult.rows[0]?.role).toBe("referral_partner");
    } finally {
      await client.end();
    }

    expect(await countRoleChangeAuditRows(targetUserId)).toBe(1);
  });

  test("posting the same role returns unchanged true and does not duplicate the audit row", async ({ request }) => {
    const adminEmail = `admin-role-unchanged-${Date.now()}@test.local`;
    await createTestUser(request, adminEmail, "Role Admin", "admin");

    const targetEmail = `patient-role-unchanged-${Date.now()}@test.local`;
    const { userId: targetUserId } = await createTestUser(request, targetEmail, "Role Patient", "patient");

    await loginTestUser(request, adminEmail);

    const response = await request.post(`/api/admin/users/${targetUserId}/role`, {
      data: { role: "patient" },
    });
    expect(response.ok(), `No-op role change failed: ${await response.text()}`).toBeTruthy();
    await expect(response.json()).resolves.toMatchObject({ ok: true, unchanged: true });

    expect(await countRoleChangeAuditRows(targetUserId)).toBe(0);
  });

  test("admin can create a referral partner profile for a referral_partner user", async ({
    request,
  }) => {
    const adminEmail = `admin-partner-create-${Date.now()}@test.local`;
    await createTestUser(request, adminEmail, "Role Admin", "admin");

    const partnerEmail = `partner-profile-create-${Date.now()}@test.local`;
    const { userId: partnerUserId } = await createTestUser(
      request,
      partnerEmail,
      "Partner User",
      "referral_partner",
    );

    await loginTestUser(request, adminEmail);

    const response = await request.post("/api/admin/referral-partners", {
      data: {
        userId: partnerUserId,
        organizationName: "City Clinic",
      },
    });

    expect(response.ok(), `Partner profile create failed: ${await response.text()}`).toBeTruthy();
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      profile: {
        userId: partnerUserId,
        organizationName: "City Clinic",
        status: "active",
      },
    });

    expect(await getReferralPartnerRow(partnerUserId)).toMatchObject({
      user_id: partnerUserId,
      organization_name: "City Clinic",
      status: "active",
    });
  });

  test("admin can deactivate an existing referral partner profile", async ({ request }) => {
    const adminEmail = `admin-partner-status-${Date.now()}@test.local`;
    await createTestUser(request, adminEmail, "Role Admin", "admin");

    const partnerEmail = `partner-profile-status-${Date.now()}@test.local`;
    const { userId: partnerUserId } = await createTestUser(
      request,
      partnerEmail,
      "Partner User",
      "referral_partner",
    );

    await loginTestUser(request, adminEmail);

    const createResponse = await request.post("/api/admin/referral-partners", {
      data: {
        userId: partnerUserId,
        organizationName: "City Clinic",
      },
    });
    expect(createResponse.ok(), `Partner profile seed failed: ${await createResponse.text()}`).toBeTruthy();

    const response = await request.patch(`/api/admin/referral-partners/${partnerUserId}`, {
      data: { status: "inactive" },
    });

    expect(response.ok(), `Partner profile patch failed: ${await response.text()}`).toBeTruthy();
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      profile: {
        userId: partnerUserId,
        status: "inactive",
      },
    });

    expect(await getReferralPartnerRow(partnerUserId)).toMatchObject({
      user_id: partnerUserId,
      status: "inactive",
    });
  });

  test("non-admin actors cannot create referral partner profiles", async ({ request }) => {
    const patientEmail = `patient-partner-create-${Date.now()}@test.local`;
    await createTestUser(request, patientEmail, "Plain Patient", "patient");

    const partnerEmail = `partner-profile-forbidden-${Date.now()}@test.local`;
    const { userId: partnerUserId } = await createTestUser(
      request,
      partnerEmail,
      "Partner User",
      "referral_partner",
    );

    await loginTestUser(request, patientEmail);

    const response = await request.post("/api/admin/referral-partners", {
      data: {
        userId: partnerUserId,
        organizationName: "City Clinic",
      },
    });

    expect(response.status()).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "Forbidden" });
    expect(await getReferralPartnerRow(partnerUserId)).toBeNull();
  });
});
