import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { getDbClient, resetDb, seedNurse } from "../e2e-utils/db";
import { createTestUser, loginTestUser } from "../e2e-utils/helpers";

let contractsModulePromise: Promise<typeof import("@nurseconnect/contracts")> | null = null;

async function loadContractsModule() {
  if (!contractsModulePromise) {
    contractsModulePromise = import("@nurseconnect/contracts");
  }
  return contractsModulePromise;
}

function asUuidOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function metadataKey(metadata: { previousNurseUserId: string | null; newNurseUserId: string | null }) {
  return `${metadata.previousNurseUserId ?? "null"}->${metadata.newNurseUserId ?? "null"}`;
}

test.describe("Admin Request Reassign API", () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test("unauthenticated access returns 401", async ({ request }) => {
    const requestId = randomUUID();
    const response = await request.post(`/api/admin/requests/${requestId}/reassign`, {
      data: { nurseUserId: null },
    });
    expect(response.status()).toBe(401);
  });

  test("non-admin access returns 403", async ({ request }) => {
    const patientEmail = `reassign-patient-${Date.now()}@test.local`;
    await createTestUser(request, patientEmail, "Reassign Patient", "patient");
    await loginTestUser(request, patientEmail);

    const requestId = randomUUID();
    const response = await request.post(`/api/admin/requests/${requestId}/reassign`, {
      data: { nurseUserId: null },
    });
    expect(response.status()).toBe(403);
  });

  test("admin can assign, reassign, and unassign while keeping nurse availability coherent", async ({
    request,
  }) => {
    const adminEmail = `reassign-admin-${Date.now()}@test.local`;
    await createTestUser(request, adminEmail, "Reassign Admin", "admin");

    const patientEmail = `reassign-patient-${Date.now()}@test.local`;
    const { userId: patientUserId } = await createTestUser(
      request,
      patientEmail,
      "Reassign Patient",
      "patient",
    );

    const nurseOneEmail = `reassign-nurse-one-${Date.now()}@test.local`;
    const { userId: nurseOneUserId } = await createTestUser(
      request,
      nurseOneEmail,
      "Reassign Nurse One",
      "nurse",
    );
    await seedNurse({
      userId: nurseOneUserId,
      licenseNumber: "RN-REASSIGN-1",
      specialization: "General",
      isAvailable: true,
    });

    const nurseTwoEmail = `reassign-nurse-two-${Date.now()}@test.local`;
    const { userId: nurseTwoUserId } = await createTestUser(
      request,
      nurseTwoEmail,
      "Reassign Nurse Two",
      "nurse",
    );
    await seedNurse({
      userId: nurseTwoUserId,
      licenseNumber: "RN-REASSIGN-2",
      specialization: "Cardio",
      isAvailable: true,
    });

    const requestId = randomUUID();
    const client = getDbClient();
    await client.connect();
    try {
      await client.query(
        `INSERT INTO service_requests
          (id, patient_user_id, assigned_nurse_user_id, status, address, lat, lng, created_at, updated_at)
         VALUES
          ($1, $2, NULL, 'open', 'Admin Reassign Street', '42.662900', '21.165500', NOW(), NOW())`,
        [requestId, patientUserId],
      );
    } finally {
      await client.end();
    }

    await loginTestUser(request, adminEmail);

    const assignResponse = await request.post(`/api/admin/requests/${requestId}/reassign`, {
      data: { nurseUserId: nurseOneUserId },
    });
    expect(assignResponse.ok(), `Assign failed: ${await assignResponse.text()}`).toBeTruthy();
    const assignBody = await assignResponse.json();
    expect(assignBody.request.status).toBe("assigned");
    expect(assignBody.request.assignedNurseUserId).toBe(nurseOneUserId);

    const reassignResponse = await request.post(`/api/admin/requests/${requestId}/reassign`, {
      data: { nurseUserId: nurseTwoUserId },
    });
    expect(reassignResponse.ok(), `Reassign failed: ${await reassignResponse.text()}`).toBeTruthy();
    const reassignBody = await reassignResponse.json();
    expect(reassignBody.request.status).toBe("assigned");
    expect(reassignBody.request.assignedNurseUserId).toBe(nurseTwoUserId);

    const verifyClient = getDbClient();
    await verifyClient.connect();
    try {
      const nurseOneState = await verifyClient.query(
        "SELECT is_available FROM nurses WHERE user_id = $1",
        [nurseOneUserId],
      );
      const nurseTwoState = await verifyClient.query(
        "SELECT is_available FROM nurses WHERE user_id = $1",
        [nurseTwoUserId],
      );

      expect(nurseOneState.rows[0]?.is_available).toBe(true);
      expect(nurseTwoState.rows[0]?.is_available).toBe(false);
    } finally {
      await verifyClient.end();
    }

    const unassignResponse = await request.post(`/api/admin/requests/${requestId}/reassign`, {
      data: { nurseUserId: null },
    });
    expect(unassignResponse.ok(), `Unassign failed: ${await unassignResponse.text()}`).toBeTruthy();
    const unassignBody = await unassignResponse.json();
    expect(unassignBody.request.status).toBe("open");
    expect(unassignBody.request.assignedNurseUserId).toBeNull();

    const contracts = await loadContractsModule();

    const eventsResponse = await request.get(`/api/requests/${requestId}/events`);
    expect(eventsResponse.ok(), `Events fetch failed: ${await eventsResponse.text()}`).toBeTruthy();
    const events = contracts.GetRequestEventsResponseSchema.parse(await eventsResponse.json());
    const reassignmentEvents = events.filter((event) => event.type === "request_reassigned");

    expect(reassignmentEvents.length).toBe(3);

    const reassignmentEventMetadata = reassignmentEvents.map((event) =>
      contracts.RequestReassignedMetadataSchema.parse({
        previousNurseUserId: asUuidOrNull(event.meta?.previousNurseUserId),
        newNurseUserId: asUuidOrNull(event.meta?.newNurseUserId),
      }),
    );
    expect(reassignmentEventMetadata).toEqual([
      { previousNurseUserId: null, newNurseUserId: nurseOneUserId },
      { previousNurseUserId: nurseOneUserId, newNurseUserId: nurseTwoUserId },
      { previousNurseUserId: nurseTwoUserId, newNurseUserId: null },
    ]);

    const activityResponse = await request.get("/api/admin/activity/reassignments?limit=200");
    expect(activityResponse.ok(), `Activity feed failed: ${await activityResponse.text()}`).toBeTruthy();
    const activity = contracts.AdminReassignmentActivityResponseSchema.parse(await activityResponse.json());
    const requestActivity = activity.items.filter((item) => item.requestId === requestId);

    expect(requestActivity.length).toBeGreaterThanOrEqual(6);

    const requestEventMetadataKeys = new Set(
      requestActivity
        .filter((item) => item.source === "request-event")
        .map((item) => metadataKey(item.metadata)),
    );
    const auditMetadataKeys = new Set(
      requestActivity
        .filter((item) => item.source === "admin-audit")
        .map((item) => metadataKey(item.metadata)),
    );
    const expectedMetadataKeys = reassignmentEventMetadata.map((metadata) => metadataKey(metadata));

    expect(requestEventMetadataKeys).toEqual(new Set(expectedMetadataKeys));
    expect(auditMetadataKeys).toEqual(new Set(expectedMetadataKeys));
  });

  test("admin cannot reassign to a submitted or expired nurse", async ({ request }) => {
    const adminEmail = `reassign-block-admin-${Date.now()}@test.local`;
    await createTestUser(request, adminEmail, "Reassign Block Admin", "admin");

    const patientEmail = `reassign-block-patient-${Date.now()}@test.local`;
    const { userId: patientUserId } = await createTestUser(
      request,
      patientEmail,
      "Reassign Block Patient",
      "patient",
    );

    const submittedNurseEmail = `reassign-submitted-${Date.now()}@test.local`;
    const { userId: submittedNurseUserId } = await createTestUser(
      request,
      submittedNurseEmail,
      "Submitted Nurse",
      "nurse",
    );
    await seedNurse({
      userId: submittedNurseUserId,
      licenseNumber: "RN-REASSIGN-SUBMITTED",
      specialization: "General",
      isAvailable: true,
      status: "submitted",
      licenseJurisdiction: "CA",
    });

    const expiredNurseEmail = `reassign-expired-${Date.now()}@test.local`;
    const { userId: expiredNurseUserId } = await createTestUser(
      request,
      expiredNurseEmail,
      "Expired Nurse",
      "nurse",
    );
    await seedNurse({
      userId: expiredNurseUserId,
      licenseNumber: "RN-REASSIGN-EXPIRED",
      specialization: "Cardio",
      isAvailable: true,
      status: "verified",
      licenseJurisdiction: "CA",
      licenseValidUntil: "2020-01-01T00:00:00.000Z",
    });

    const requestId = randomUUID();
    const client = getDbClient();
    await client.connect();
    try {
      await client.query(
        `INSERT INTO service_requests
          (id, patient_user_id, assigned_nurse_user_id, status, address, lat, lng, created_at, updated_at)
         VALUES
          ($1, $2, NULL, 'open', 'Admin Reassign Block Street', '42.662900', '21.165500', NOW(), NOW())`,
        [requestId, patientUserId],
      );
    } finally {
      await client.end();
    }

    await loginTestUser(request, adminEmail);

    const submittedResponse = await request.post(`/api/admin/requests/${requestId}/reassign`, {
      data: { nurseUserId: submittedNurseUserId },
    });
    expect(submittedResponse.status()).toBe(400);
    await expect(submittedResponse.json()).resolves.toMatchObject({
      error: "Target nurse is not verified",
    });

    const expiredResponse = await request.post(`/api/admin/requests/${requestId}/reassign`, {
      data: { nurseUserId: expiredNurseUserId },
    });
    expect(expiredResponse.status()).toBe(400);
    await expect(expiredResponse.json()).resolves.toMatchObject({
      error: "Target nurse license has expired",
    });
  });
});
