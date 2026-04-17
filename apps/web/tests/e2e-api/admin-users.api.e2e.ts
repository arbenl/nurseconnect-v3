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
});
