import { expect, test } from "@playwright/test";

import { getDbClient, resetDb } from "../e2e-utils/db";
import { createTestUser, loginTestUser } from "../e2e-utils/helpers";

test.describe("Health and Ops Status API", () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test("composite health reports active service areas and verified available nurse supply", async ({
    request,
  }) => {
    const client = getDbClient();
    await client.connect();
    try {
      const users = await client.query(
        `INSERT INTO users (email, role)
         VALUES
           ('health-verified-available@test.local', 'nurse'),
           ('health-verified-unavailable@test.local', 'nurse'),
           ('health-submitted-available@test.local', 'patient')
         RETURNING id`,
      );

      await client.query(
        `INSERT INTO nurses
           (user_id, status, license_number, license_jurisdiction, specialization, license_valid_until, is_available)
         VALUES
           ($1, 'verified', 'RN-HEALTH-001', 'CA', 'ICU', '2027-12-31T00:00:00.000Z', true),
           ($2, 'verified', 'RN-HEALTH-002', 'CA', 'ER', '2027-12-31T00:00:00.000Z', false),
           ($3, 'submitted', 'RN-HEALTH-003', 'CA', 'General', NULL, true)`,
        [users.rows[0].id, users.rows[1].id, users.rows[2].id],
      );

      await client.query(
        `INSERT INTO service_areas (label, center_lat, center_lng, radius_meters, status)
         VALUES
           ('Health Active Area', '42.662900', '21.165500', 15000, 'active'),
           ('Health Paused Area', '42.662900', '21.165500', 15000, 'paused')`,
      );
    } finally {
      await client.end();
    }

    const response = await request.get("/api/health");
    expect(response.ok(), `Health failed: ${await response.text()}`).toBeTruthy();

    const body = await response.json();
    expect(body).toMatchObject({
      ok: true,
      db: "ok",
      serviceAreas: { active: 4 },
      nurseSupply: { verifiedAndAvailable: 1 },
    });
    expect(typeof body.timestamp).toBe("string");
  });

  test("admin ops status requires admin auth and returns machine-readable counts", async ({
    request,
  }) => {
    const unauthenticated = await request.get("/api/admin/ops/status");
    expect(unauthenticated.status()).toBe(401);

    const patientEmail = `ops-status-patient-${Date.now()}@test.local`;
    await createTestUser(request, patientEmail, "Ops Status Patient", "patient");
    await loginTestUser(request, patientEmail);

    const forbidden = await request.get("/api/admin/ops/status");
    expect(forbidden.status()).toBe(403);

    await request.post("/api/auth/sign-out", { data: {} });

    const adminEmail = `ops-status-admin-${Date.now()}@test.local`;
    await createTestUser(request, adminEmail, "Ops Status Admin", "admin");
    await loginTestUser(request, adminEmail);

    const response = await request.get("/api/admin/ops/status");
    expect(response.ok(), `Ops status failed: ${await response.text()}`).toBeTruthy();

    const body = await response.json();
    expect(body).toMatchObject({
      db: "ok",
      serviceAreas: { active: expect.any(Number) },
      nurseSupply: { verifiedAndAvailable: expect.any(Number) },
      requests: {
        unassigned: expect.any(Number),
        staleAssigned: expect.any(Number),
        staleEnroute: expect.any(Number),
        exceptionQueue: expect.any(Number),
      },
      payments: {
        authorizationsWithoutPayout: expect.any(Number),
        recentFailedAuthorizations: expect.any(Number),
        recentFailedPayouts: expect.any(Number),
      },
    });
    expect(typeof body.generatedAt).toBe("string");
  });
});
