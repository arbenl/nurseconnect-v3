import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { getDbClient, resetDb } from "../e2e-utils/db";
import { createTestUser, loginTestUser } from "../e2e-utils/helpers";

test.describe("Admin Service Areas API", () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test("unauthenticated access returns 401", async ({ request }) => {
    const response = await request.get("/api/admin/service-areas");

    expect(response.status()).toBe(401);
  });

  test("admin can create, update, pause, and list service areas with audit trail", async ({
    request,
  }) => {
    const adminEmail = `service-area-admin-${Date.now()}@test.local`;
    const { userId: adminUserId } = await createTestUser(
      request,
      adminEmail,
      "Service Area Admin",
      "admin",
    );
    await loginTestUser(request, adminEmail);

    const createResponse = await request.post("/api/admin/service-areas", {
      data: {
        label: `Gjakova ${randomUUID().slice(0, 8)}`,
        centerLat: 42.3803,
        centerLng: 20.4308,
        radiusMeters: 12000,
      },
    });
    expect(createResponse.ok(), `Create failed: ${await createResponse.text()}`).toBeTruthy();
    const created = await createResponse.json();
    const serviceAreaId = created.item.id as string;

    const updateResponse = await request.patch(`/api/admin/service-areas/${serviceAreaId}`, {
      data: {
        label: "Gjakova Metro",
        radiusMeters: 18000,
      },
    });
    expect(updateResponse.ok(), `Update failed: ${await updateResponse.text()}`).toBeTruthy();
    await expect(updateResponse.json()).resolves.toMatchObject({
      item: {
        id: serviceAreaId,
        label: "Gjakova Metro",
        radiusMeters: 18000,
      },
    });

    const pauseResponse = await request.post(`/api/admin/service-areas/${serviceAreaId}/status`, {
      data: { status: "paused" },
    });
    expect(pauseResponse.ok(), `Pause failed: ${await pauseResponse.text()}`).toBeTruthy();
    await expect(pauseResponse.json()).resolves.toMatchObject({
      item: {
        id: serviceAreaId,
        status: "paused",
      },
    });

    const listResponse = await request.get("/api/admin/service-areas");
    expect(listResponse.ok(), `List failed: ${await listResponse.text()}`).toBeTruthy();
    const list = await listResponse.json();
    expect(list.items.some((item: { id: string }) => item.id === serviceAreaId)).toBe(true);

    const client = getDbClient();
    await client.connect();
    try {
      const auditRows = await client.query(
        `SELECT actor_user_id, action, target_entity_type, target_entity_id
           FROM admin_audit_logs
          WHERE target_entity_id = $1
          ORDER BY id`,
        [serviceAreaId],
      );

      expect(auditRows.rows).toEqual([
        {
          actor_user_id: adminUserId,
          action: "service_area.created",
          target_entity_type: "service_area",
          target_entity_id: serviceAreaId,
        },
        {
          actor_user_id: adminUserId,
          action: "service_area.updated",
          target_entity_type: "service_area",
          target_entity_id: serviceAreaId,
        },
        {
          actor_user_id: adminUserId,
          action: "service_area.paused",
          target_entity_type: "service_area",
          target_entity_id: serviceAreaId,
        },
      ]);
    } finally {
      await client.end();
    }
  });
});
