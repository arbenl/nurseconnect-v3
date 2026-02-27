import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { getDbClient, resetDb } from "../e2e-utils/db";
import { createTestUser, loginTestUser } from "../e2e-utils/helpers";

test.describe("Admin Requests API", () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test("unauthenticated access returns 401", async ({ request }) => {
    const response = await request.get("/api/admin/requests/active");
    expect(response.status()).toBe(401);
  });

  test("non-admin access returns 403", async ({ request }) => {
    const patientEmail = `admin-api-patient-${Date.now()}@test.local`;
    await createTestUser(request, patientEmail, "Admin API Patient", "patient");
    await loginTestUser(request, patientEmail);

    const response = await request.get("/api/admin/requests/active");
    expect(response.status()).toBe(403);
  });

  test("admin receives sorted active queue without PHI fields", async ({ request }) => {
    const adminEmail = `admin-api-admin-${Date.now()}@test.local`;
    await createTestUser(request, adminEmail, "Admin API Admin", "admin");

    const patientEmail = `admin-api-patient-${Date.now()}@test.local`;
    const { userId: patientUserId } = await createTestUser(
      request,
      patientEmail,
      "Admin API Patient",
      "patient",
    );

    const nurseEmail = `admin-api-nurse-${Date.now()}@test.local`;
    const { userId: nurseUserId } = await createTestUser(
      request,
      nurseEmail,
      "Admin API Nurse",
      "nurse",
    );

    const openRequestId = randomUUID();
    const assignedRequestId = randomUUID();
    const completedRequestId = randomUUID();
    const baseNow = Date.now();
    const openCreatedAt = new Date(baseNow - 120 * 60_000).toISOString();
    const openAssignedAt = new Date(baseNow - 119 * 60_000).toISOString();
    const assignedCreatedAt = new Date(baseNow - 40 * 60_000).toISOString();
    const assignedAssignedAt = new Date(baseNow - 39 * 60_000).toISOString();
    const completedCreatedAt = new Date(baseNow - 240 * 60_000).toISOString();
    const completedAt = new Date(baseNow - 60 * 60_000).toISOString();

    const client = getDbClient();
    await client.connect();
    try {
      await client.query(
        `INSERT INTO service_requests
          (id, patient_user_id, assigned_nurse_user_id, status, address, lat, lng, created_at, updated_at, assigned_at)
         VALUES
          ($1, $2, NULL, 'open', '123 Main Street, Pristina', '42.662900', '21.165500', $3, $4, NULL),
          ($5, $2, $6, 'assigned', '456 Side Street, Pristina', '42.650000', '21.170000', $7, $8, $9),
          ($10, $2, $6, 'completed', '789 Old Street, Pristina', '42.600000', '21.100000', $11, $12, $13)`,
        [
          openRequestId,
          patientUserId,
          openCreatedAt,
          openCreatedAt,
          assignedRequestId,
          nurseUserId,
          assignedCreatedAt,
          assignedCreatedAt,
          assignedCreatedAt,
          completedRequestId,
          completedCreatedAt,
          completedAt,
          completedAt,
        ],
      );

      await client.query(
        `INSERT INTO service_request_events
          (request_id, type, actor_user_id, from_status, to_status, meta, created_at)
         VALUES
          ($1, 'request_created', $2, NULL, 'open', '{}'::jsonb, $3),
          ($1, 'request_assigned', NULL, 'open', 'assigned', '{"nurseUserId":"placeholder"}'::jsonb, $4),
          ($5, 'request_created', $2, NULL, 'open', '{}'::jsonb, $6),
          ($5, 'request_assigned', NULL, 'open', 'assigned', '{"nurseUserId":"placeholder"}'::jsonb, $7),
          ($8, 'request_created', $2, NULL, 'open', '{}'::jsonb, $9),
          ($8, 'request_completed', $2, 'enroute', 'completed', '{}'::jsonb, $10)`,
        [
          openRequestId,
          patientUserId,
          openCreatedAt,
          openAssignedAt,
          assignedRequestId,
          assignedCreatedAt,
          assignedAssignedAt,
          completedRequestId,
          completedCreatedAt,
          completedAt,
        ],
      );
    } finally {
      await client.end();
    }

    await loginTestUser(request, adminEmail);

    const response = await request.get("/api/admin/requests/active");
    expect(response.ok(), `Admin queue failed: ${await response.text()}`).toBeTruthy();

    const body = await response.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(2);

    const [first, second] = body.items;
    expect(first.requestId).toBe(openRequestId);
    expect(second.requestId).toBe(assignedRequestId);

    expect(first.status).toBe("open");
    expect(second.status).toBe("assigned");
    expect(first.assignedNurse).toBe("unassigned");
    expect(second.assignedNurse).toBe("assigned");
    expect(first.waitMinutes).toBeGreaterThan(second.waitMinutes);
    expect(first.severityScore).toBeGreaterThan(second.severityScore);

    expect(first.locationHint).toMatch(/^~\d+\.\d{2},\d+\.\d{2}$/);
    expect(first.address).toBeUndefined();
    expect(first.patientUserId).toBeUndefined();

    expect(typeof body.generatedAt).toBe("string");
  });
});
