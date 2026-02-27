import { expect, test } from "@playwright/test";

import { resetDb, seedNurse, seedNurseLocation } from "../e2e-utils/db";
import { createTestUser, loginTestUser } from "../e2e-utils/helpers";

test.describe("Admin Requests UI", () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test("admin can drill into a queue item and see request timeline", async ({ page }) => {
    const adminEmail = `admin-ui-${Date.now()}@test.local`;
    await createTestUser(page.request, adminEmail, "Admin UI", "admin");

    const nurseEmail = `nurse-ui-${Date.now()}@test.local`;
    const { userId: nurseUserId } = await createTestUser(
      page.request,
      nurseEmail,
      "Nurse UI",
      "nurse",
    );
    await seedNurse({
      userId: nurseUserId,
      licenseNumber: "RN-UI",
      specialization: "General",
      isAvailable: true,
    });
    await seedNurseLocation({
      nurseUserId,
      lat: "42.6629",
      lng: "21.1655",
    });

    const patientEmail = `patient-ui-${Date.now()}@test.local`;
    await createTestUser(page.request, patientEmail, "Patient UI", "patient");

    await loginTestUser(page.request, patientEmail);
    const createResponse = await page.request.post("/api/requests", {
      data: {
        address: "12 Clinic Street, Pristina",
        lat: 42.6629,
        lng: 21.1655,
      },
    });
    expect(createResponse.ok(), `Request creation failed: ${await createResponse.text()}`).toBeTruthy();
    const created = await createResponse.json();

    await page.request.post("/api/auth/sign-out", { data: {} });
    await loginTestUser(page.request, adminEmail);

    await page.goto("/admin/requests", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Active Requests Queue" })).toBeVisible();

    await page.getByRole("link", { name: created.id }).click();

    await expect(page).toHaveURL(new RegExp(`/admin/requests/${created.id}$`));
    await expect(page.getByRole("heading", { name: "Request Detail" })).toBeVisible();
    await expect(page.getByText("request_created")).toBeVisible();
    await expect(page.getByText("request_assigned")).toBeVisible();
  });
});
