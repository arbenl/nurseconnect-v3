import { type APIRequestContext, expect, test } from "@playwright/test";

import { resetDb, seedNurse, seedNurseLocation } from "../e2e-utils/db";
import { createTestUser, loginTestUser } from "../e2e-utils/helpers";

async function createAssignedRequest(request: APIRequestContext) {
  const nurseEmail = `authz-nurse-${Date.now()}@test.local`;
  const { userId: nurseId } = await createTestUser(request, nurseEmail, "Authz Nurse", "nurse");
  await seedNurse({
    userId: nurseId,
    licenseNumber: "RN-AUTHZ",
    specialization: "General",
    isAvailable: true,
  });
  await seedNurseLocation({
    nurseUserId: nurseId,
    lat: "42.6629",
    lng: "21.1655",
  });

  const patientEmail = `authz-patient-${Date.now()}@test.local`;
  await createTestUser(request, patientEmail, "Authz Patient", "patient");
  await loginTestUser(request, patientEmail);

  const createResponse = await request.post("/api/requests", {
    data: {
      address: "Authz Street 1",
      lat: 42.6629,
      lng: 21.1655,
    },
  });
  expect(createResponse.ok(), `Create request failed: ${await createResponse.text()}`).toBeTruthy();
  const created = await createResponse.json();
  expect(created.status).toBe("assigned");
  expect(created.assignedNurseUserId).toBe(nurseId);

  await request.post("/api/auth/sign-out", { data: {} });

  return { requestId: created.id as string, nurseEmail, patientEmail };
}

test.describe("Authorization Matrix API", () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test("api/user endpoint is not exposed", async ({ request }) => {
    const response = await request.get("/api/user?id=00000000-0000-0000-0000-000000000001");
    expect(response.status()).toBe(404);
  });

  test("unauthenticated request creation returns 401", async ({ request }) => {
    const response = await request.post("/api/requests", {
      data: {
        address: "Unauthorized Street",
        lat: 42.6629,
        lng: 21.1655,
      },
    });
    expect(response.status()).toBe(401);
  });

  test("nurse cannot create patient request (403)", async ({ request }) => {
    const nurseEmail = `authz-create-nurse-${Date.now()}@test.local`;
    await createTestUser(request, nurseEmail, "Authz Create Nurse", "nurse");
    await loginTestUser(request, nurseEmail);

    const response = await request.post("/api/requests", {
      data: {
        address: "Forbidden Street",
        lat: 42.6629,
        lng: 21.1655,
      },
    });
    expect(response.status()).toBe(403);
  });

  test("patient cannot accept request (403)", async ({ request }) => {
    const { requestId, patientEmail } = await createAssignedRequest(request);
    await loginTestUser(request, patientEmail);

    const response = await request.post(`/api/requests/${requestId}/accept`, { data: {} });
    expect(response.status()).toBe(403);
  });

  test("nurse cannot cancel request (403)", async ({ request }) => {
    const { requestId, nurseEmail } = await createAssignedRequest(request);
    await loginTestUser(request, nurseEmail);

    const response = await request.post(`/api/requests/${requestId}/cancel`, { data: {} });
    expect(response.status()).toBe(403);
  });

  test("authorized nurse gets 404 for missing request", async ({ request }) => {
    const nurseEmail = `authz-missing-nurse-${Date.now()}@test.local`;
    await createTestUser(request, nurseEmail, "Authz Missing Nurse", "nurse");
    await loginTestUser(request, nurseEmail);

    const missingId = "00000000-0000-0000-0000-000000000000";
    const response = await request.post(`/api/requests/${missingId}/accept`, { data: {} });
    expect(response.status()).toBe(404);
  });
});
