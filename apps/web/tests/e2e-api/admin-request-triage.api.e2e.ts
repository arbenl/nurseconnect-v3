import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { getDbClient, resetDb, seedNurse } from "../e2e-utils/db";
import { DEFAULT_BRANCH_ID, DEFAULT_ORGANIZATION_ID, createTestUser, loginTestUser } from "../e2e-utils/helpers";

test.describe("Admin Request Triage API", () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test("unauthenticated access returns 401", async ({ request }) => {
    const response = await request.post(`/api/admin/requests/${randomUUID()}/triage`, {
      data: { action: "needs_review" },
    });

    expect(response.status()).toBe(401);
  });

  test("admin triage requires reasons for terminal outcomes and records exception audit trail", async ({
    request,
  }) => {
    const adminEmail = `triage-admin-${Date.now()}@test.local`;
    const { userId: adminUserId } = await createTestUser(
      request,
      adminEmail,
      "Triage Admin",
      "admin",
    );

    const patientEmail = `triage-patient-${Date.now()}@test.local`;
    const { userId: patientUserId } = await createTestUser(
      request,
      patientEmail,
      "Triage Patient",
      "patient",
    );

    const nurseEmail = `triage-nurse-${Date.now()}@test.local`;
    const { userId: nurseUserId } = await createTestUser(
      request,
      nurseEmail,
      "Triage Nurse",
      "nurse",
    );
    await seedNurse({
      userId: nurseUserId,
      licenseNumber: "RN-TRIAGE-1",
      specialization: "General",
      isAvailable: false,
    });

    const requestId = randomUUID();
    const client = getDbClient();
    await client.connect();
    try {
      await client.query(
        `INSERT INTO service_requests
          (id, organization_id, branch_id, patient_user_id, assigned_nurse_user_id, status, address, lat, lng, assigned_at, created_at, updated_at)
         VALUES
          ($1, $2, $3, $4, $5, 'assigned', 'Admin Triage Street', '42.662900', '21.165500', NOW(), NOW(), NOW())`,
        [requestId, DEFAULT_ORGANIZATION_ID, DEFAULT_BRANCH_ID, patientUserId, nurseUserId],
      );
    } finally {
      await client.end();
    }

    await loginTestUser(request, adminEmail);

    const badDecline = await request.post(`/api/admin/requests/${requestId}/triage`, {
      data: { action: "decline" },
    });
    expect(badDecline.status()).toBe(400);

    const reviewResponse = await request.post(`/api/admin/requests/${requestId}/triage`, {
      data: { action: "needs_review", reason: "Needs escalation review" },
    });
    expect(reviewResponse.ok(), `Needs review failed: ${await reviewResponse.text()}`).toBeTruthy();
    const reviewBody = await reviewResponse.json();
    expect(reviewBody.request.status).toBe("needs_review");
    expect(reviewBody.request.assignedNurseUserId).toBeNull();

    const declineResponse = await request.post(`/api/admin/requests/${requestId}/triage`, {
      data: { action: "decline", reason: "Outside clinical scope" },
    });
    expect(declineResponse.ok(), `Decline failed: ${await declineResponse.text()}`).toBeTruthy();
    const declineBody = await declineResponse.json();
    expect(declineBody.request.status).toBe("declined");
    expect(declineBody.request.declinedAt).toBeTruthy();

    const verifyClient = getDbClient();
    await verifyClient.connect();
    try {
      const nurseState = await verifyClient.query(
        "SELECT is_available FROM nurses WHERE user_id = $1",
        [nurseUserId],
      );
      expect(nurseState.rows[0]?.is_available).toBe(true);

      const eventRows = await verifyClient.query(
        `SELECT type, actor_user_id, from_status, to_status, meta
         FROM service_request_events
         WHERE request_id = $1
         ORDER BY id`,
        [requestId],
      );
      expect(eventRows.rows.map((row) => row.type)).toEqual([
        "request_needs_review",
        "request_declined",
      ]);
      expect(eventRows.rows[1]).toMatchObject({
        actor_user_id: adminUserId,
        from_status: "needs_review",
        to_status: "declined",
      });
      expect(eventRows.rows[1]?.meta).toMatchObject({
        reason: "Outside clinical scope",
      });

      const auditRows = await verifyClient.query(
        `SELECT action, target_entity_id, details
         FROM admin_audit_logs
         WHERE target_entity_id = $1
         ORDER BY id`,
        [requestId],
      );
      expect(auditRows.rows.map((row) => row.action)).toEqual([
        "request.needs_review",
        "request.declined",
      ]);
      expect(auditRows.rows[1]).toMatchObject({
        target_entity_id: requestId,
      });
      expect(auditRows.rows[1]?.details).toMatchObject({
        requestId,
        reason: "Outside clinical scope",
      });
    } finally {
      await verifyClient.end();
    }
  });
});
