import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { getDbClient, resetDb, seedNurse } from "../e2e-utils/db";
import { DEFAULT_BRANCH_ID, DEFAULT_ORGANIZATION_ID, createTestUser, loginTestUser } from "../e2e-utils/helpers";

test.describe("Admin Request Payments API", () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test("unauthenticated access returns 401", async ({ request }) => {
    const response = await request.get(`/api/admin/requests/${randomUUID()}/payments`);

    expect(response.status()).toBe(401);
  });

  test("admin records private-pay authorization and nurse payout traces", async ({
    request,
  }) => {
    const adminEmail = `payments-admin-${Date.now()}@test.local`;
    const { userId: adminUserId } = await createTestUser(
      request,
      adminEmail,
      "Payments Admin",
      "admin",
    );

    const patientEmail = `payments-patient-${Date.now()}@test.local`;
    const { userId: patientUserId } = await createTestUser(
      request,
      patientEmail,
      "Payments Patient",
      "patient",
    );

    const nurseEmail = `payments-nurse-${Date.now()}@test.local`;
    const { userId: nurseUserId } = await createTestUser(
      request,
      nurseEmail,
      "Payments Nurse",
      "nurse",
    );
    await seedNurse({
      userId: nurseUserId,
      licenseNumber: "RN-PAYMENTS-1",
      specialization: "General",
      isAvailable: true,
    });

    const requestId = randomUUID();
    const client = getDbClient();
    await client.connect();
    try {
      await client.query(
        `INSERT INTO service_requests
          (id, organization_id, branch_id, patient_user_id, assigned_nurse_user_id, status, address, lat, lng, completed_at, created_at, updated_at)
         VALUES
          ($1, $2, $3, $4, $5, 'completed', 'Admin Payments Street', '42.662900', '21.165500', NOW(), NOW(), NOW())`,
        [requestId, DEFAULT_ORGANIZATION_ID, DEFAULT_BRANCH_ID, patientUserId, nurseUserId],
      );
    } finally {
      await client.end();
    }

    await loginTestUser(request, adminEmail);

    const emptyTrace = await request.get(`/api/admin/requests/${requestId}/payments`);
    expect(emptyTrace.ok(), `Empty trace failed: ${await emptyTrace.text()}`).toBeTruthy();
    expect(await emptyTrace.json()).toMatchObject({
      requestId,
      authorization: null,
      payout: null,
    });

    const recordAuthorization = await request.post(`/api/admin/requests/${requestId}/payments`, {
      data: {
        kind: "authorization",
        action: "record",
        amountCents: 15000,
        currency: "USD",
        provider: "manual",
        providerReference: "auth-001",
      },
    });
    expect(recordAuthorization.ok(), `Record auth failed: ${await recordAuthorization.text()}`).toBeTruthy();

    const captureAuthorization = await request.post(`/api/admin/requests/${requestId}/payments`, {
      data: {
        kind: "authorization",
        action: "capture",
        providerReference: "capture-001",
      },
    });
    expect(captureAuthorization.ok(), `Capture auth failed: ${await captureAuthorization.text()}`).toBeTruthy();
    expect(await captureAuthorization.json()).toMatchObject({
      authorization: {
        requestId,
        status: "captured",
        amountCents: 15000,
        providerReference: "capture-001",
      },
    });

    const recordPayout = await request.post(`/api/admin/requests/${requestId}/payments`, {
      data: {
        kind: "payout",
        action: "record",
        nurseUserId,
        amountCents: 9000,
        currency: "USD",
        provider: "manual",
      },
    });
    expect(recordPayout.ok(), `Record payout failed: ${await recordPayout.text()}`).toBeTruthy();

    const markPaid = await request.post(`/api/admin/requests/${requestId}/payments`, {
      data: {
        kind: "payout",
        action: "mark_paid",
        providerReference: "payout-001",
      },
    });
    expect(markPaid.ok(), `Mark paid failed: ${await markPaid.text()}`).toBeTruthy();
    expect(await markPaid.json()).toMatchObject({
      payout: {
        requestId,
        nurseUserId,
        status: "paid",
        amountCents: 9000,
        providerReference: "payout-001",
      },
    });

    const verifyClient = getDbClient();
    await verifyClient.connect();
    try {
      const auditRows = await verifyClient.query(
        `SELECT action, actor_user_id, target_entity_id, details
         FROM admin_audit_logs
         WHERE target_entity_id = $1
         ORDER BY id`,
        [requestId],
      );
      expect(auditRows.rows.map((row) => row.action)).toEqual([
        "payment.authorization.recorded",
        "payment.authorization.captured",
        "payout.recorded",
        "payout.marked_paid",
      ]);
      expect(auditRows.rows[0]).toMatchObject({
        actor_user_id: adminUserId,
        target_entity_id: requestId,
      });
      expect(auditRows.rows[3]?.details).toMatchObject({
        requestId,
        action: "mark_paid",
        providerReference: "payout-001",
      });
    } finally {
      await verifyClient.end();
    }
  });
});
