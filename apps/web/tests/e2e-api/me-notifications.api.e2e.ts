import { expect, test } from "@playwright/test";

import { resetDb, seedNurse, seedNurseLocation } from "../e2e-utils/db";
import { createTestUser, loginTestUser, markProfileComplete } from "../e2e-utils/helpers";

let contractsModulePromise: Promise<typeof import("@nurseconnect/contracts")> | null = null;

async function loadContractsModule() {
  if (!contractsModulePromise) {
    contractsModulePromise = import("@nurseconnect/contracts");
  }

  return contractsModulePromise;
}

test.describe("Me Notifications API", () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test("current actor sees only notification-visible events for their requests", async ({
    request,
  }) => {
    const nearNurseEmail = `notif-near-nurse-${Date.now()}@test.local`;
    const { userId: nearNurseId } = await createTestUser(
      request,
      nearNurseEmail,
      "Near Nurse",
      "nurse",
    );
    await seedNurse({
      userId: nearNurseId,
      licenseNumber: "RN-NOTIF-NEAR",
      specialization: "General",
      isAvailable: true,
    });
    await seedNurseLocation({
      nurseUserId: nearNurseId,
      lat: "42.662900",
      lng: "21.165500",
    });

    const farNurseEmail = `notif-far-nurse-${Date.now()}@test.local`;
    const { userId: farNurseId } = await createTestUser(
      request,
      farNurseEmail,
      "Far Nurse",
      "nurse",
    );
    await seedNurse({
      userId: farNurseId,
      licenseNumber: "RN-NOTIF-FAR",
      specialization: "General",
      isAvailable: true,
    });
    await seedNurseLocation({
      nurseUserId: farNurseId,
      lat: "40.000000",
      lng: "20.000000",
    });

    const patientOneEmail = `notif-patient-one-${Date.now()}@test.local`;
    await createTestUser(request, patientOneEmail, "Notif Patient One", "patient");
    await markProfileComplete(patientOneEmail);

    const patientTwoEmail = `notif-patient-two-${Date.now()}@test.local`;
    await createTestUser(request, patientTwoEmail, "Notif Patient Two", "patient");
    await markProfileComplete(patientTwoEmail);

    await loginTestUser(request, patientOneEmail);
    const patientOneCreateResponse = await request.post("/api/requests", {
      data: {
        address: "Notifications One",
        lat: 42.6629,
        lng: 21.1655,
      },
    });
    expect(patientOneCreateResponse.ok(), await patientOneCreateResponse.text()).toBeTruthy();
    const patientOneRequest = await patientOneCreateResponse.json();
    await request.post("/api/auth/sign-out", { data: {} });

    await loginTestUser(request, patientTwoEmail);
    const patientTwoCreateResponse = await request.post("/api/requests", {
      data: {
        address: "Notifications Two",
        lat: 40,
        lng: 20,
      },
    });
    expect(patientTwoCreateResponse.ok(), await patientTwoCreateResponse.text()).toBeTruthy();
    await patientTwoCreateResponse.json();
    await request.post("/api/auth/sign-out", { data: {} });

    await loginTestUser(request, patientOneEmail);
    const response = await request.get("/api/me/notifications");
    expect(response.ok(), `Notifications request failed: ${await response.text()}`).toBeTruthy();

    const contracts = await loadContractsModule();
    const notifications = contracts.GetRequestEventsResponseSchema.parse(await response.json());

    expect(notifications).toHaveLength(2);
    expect(notifications.every((event) => event.requestId === patientOneRequest.id)).toBe(true);
  });

  test("invalid limit returns 400", async ({ request }) => {
    const patientEmail = `notif-invalid-limit-${Date.now()}@test.local`;
    await createTestUser(request, patientEmail, "Notif Invalid Limit", "patient");
    await loginTestUser(request, patientEmail);

    const response = await request.get("/api/me/notifications?limit=abc");
    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "limit must be an integer" });
  });
});
