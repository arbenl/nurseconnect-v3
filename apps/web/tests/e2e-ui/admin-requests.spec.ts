import { expect, test } from "@playwright/test";

import { getDbClient, resetDb, seedNurse, seedNurseLocation } from "../e2e-utils/db";
import { createTestUser, loginTestUser } from "../e2e-utils/helpers";

async function submitNurseApplication(
  request: Parameters<typeof test>[0]["request"],
  email: string,
) {
  await loginTestUser(request, email);
  const response = await request.post("/api/me/become-nurse", {
    data: {
      licenseNumber: "RN-ADMIN-UI-001",
      licenseJurisdiction: "CA",
      specialization: "General",
    },
  });
  expect(response.ok(), `Application failed: ${await response.text()}`).toBeTruthy();
  await request.post("/api/auth/sign-out", { data: {} });
}

test.describe("Admin Requests UI", () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test("admin credential review shows inline validation errors without browser alerts", async ({
    page,
  }) => {
    const adminEmail = `admin-review-ui-${Date.now()}@test.local`;
    await createTestUser(page.request, adminEmail, "Admin Review UI", "admin");

    const applicantEmail = `applicant-review-ui-${Date.now()}@test.local`;
    const { userId: applicantUserId } = await createTestUser(
      page.request,
      applicantEmail,
      "Applicant Review UI",
      "patient",
    );
    await submitNurseApplication(page.request, applicantEmail);

    await loginTestUser(page.request, adminEmail);
    const queueResponse = await page.request.get("/api/admin/nurses");
    const queue = await queueResponse.json();
    const applicant = queue.items.find((item: { userId: string }) => item.userId === applicantUserId);
    expect(applicant).toBeTruthy();

    let dialogMessage: string | null = null;
    page.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    await page.goto(`/admin/nurses/${applicant.id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Review Application" })).toBeVisible();

    await page.getByLabel("License Valid Until").fill("2020-01-01");
    await page.getByRole("button", { name: "Verify & Approve" }).click();

    await expect(page.getByTestId("credential-review-feedback")).toContainText(
      "licenseValidUntil must be in the future",
    );
    expect(dialogMessage).toBeNull();
    await expect(page).toHaveURL(new RegExp(`/admin/nurses/${applicant.id}$`));
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

  test("admin can reassign and unassign a request from detail page", async ({ page }) => {
    const adminEmail = `admin-ui-reassign-${Date.now()}@test.local`;
    await createTestUser(page.request, adminEmail, "Admin UI Reassign", "admin");

    const nurseAEmail = `nurse-a-ui-${Date.now()}@test.local`;
    const { userId: nurseAUserId } = await createTestUser(
      page.request,
      nurseAEmail,
      "Nurse A UI",
      "nurse",
    );
    await seedNurse({
      userId: nurseAUserId,
      licenseNumber: "RN-UI-A",
      specialization: "General",
      isAvailable: true,
    });
    await seedNurseLocation({
      nurseUserId: nurseAUserId,
      lat: "42.6629",
      lng: "21.1655",
    });

    const nurseBEmail = `nurse-b-ui-${Date.now()}@test.local`;
    const { userId: nurseBUserId } = await createTestUser(
      page.request,
      nurseBEmail,
      "Nurse B UI",
      "nurse",
    );
    await seedNurse({
      userId: nurseBUserId,
      licenseNumber: "RN-UI-B",
      specialization: "Cardio",
      isAvailable: true,
    });
    await seedNurseLocation({
      nurseUserId: nurseBUserId,
      lat: "42.8000",
      lng: "21.3000",
    });

    const patientEmail = `patient-ui-reassign-${Date.now()}@test.local`;
    await createTestUser(page.request, patientEmail, "Patient UI Reassign", "patient");

    await loginTestUser(page.request, patientEmail);
    const createResponse = await page.request.post("/api/requests", {
      data: {
        address: "24 Hospital Street, Pristina",
        lat: 42.6629,
        lng: 21.1655,
      },
    });
    expect(createResponse.ok(), `Request creation failed: ${await createResponse.text()}`).toBeTruthy();
    const created = await createResponse.json();

    await page.request.post("/api/auth/sign-out", { data: {} });
    await loginTestUser(page.request, adminEmail);

    await page.goto(`/admin/requests/${created.id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Request Detail" })).toBeVisible();
    await expect(page.getByTestId("reassign-panel")).toHaveAttribute("data-hydrated", "true");

    let dialogMessage: string | null = null;
    page.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    await page.getByTestId("reassign-select").selectOption(nurseBUserId);
    await page.getByRole("button", { name: "Assign Selected Nurse" }).click();
    await expect(page.getByTestId("reassign-feedback")).toContainText("Request reassigned to");

    await expect
      .poll(async () => {
        const client = getDbClient();
        await client.connect();
        try {
          const result = await client.query(
            "SELECT assigned_nurse_user_id FROM service_requests WHERE id = $1",
            [created.id],
          );
          return result.rows[0]?.assigned_nurse_user_id ?? null;
        } finally {
          await client.end();
        }
      })
      .toBe(nurseBUserId);

    await page.getByRole("button", { name: "Unassign Request" }).click();
    await expect(page.getByTestId("reassign-feedback")).toHaveText("Request unassigned.");
    await expect
      .poll(async () => {
        const client = getDbClient();
        await client.connect();
        try {
          const result = await client.query(
            "SELECT assigned_nurse_user_id FROM service_requests WHERE id = $1",
            [created.id],
          );
          return result.rows[0]?.assigned_nurse_user_id ?? null;
        } finally {
          await client.end();
        }
      })
      .toBe(null);
    expect(dialogMessage).toBeNull();
  });
});
