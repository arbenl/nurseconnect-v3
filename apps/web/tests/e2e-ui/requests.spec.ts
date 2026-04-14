import { expect, test, type Page } from "@playwright/test";

import { resetDb, seedNurse, seedNurseLocation } from "../e2e-utils/db";
import { createTestUser, loginTestUser, markProfileComplete } from "../e2e-utils/helpers";

async function seedAvailableNurse(
  page: Page,
  email: string,
  lat: string,
  lng: string,
) {
  const { userId } = await createTestUser(page.request, email, "Nurse User", "nurse");
  await markProfileComplete(email, { phone: "555-9000" });
  await seedNurse({
    userId,
    licenseNumber: "RN-REQUEST-001",
    licenseJurisdiction: "XK",
    specialization: "General",
    isAvailable: true,
    status: "verified",
    licenseValidUntil: new Date(Date.now() + 86_400_000).toISOString(),
  });
  await seedNurseLocation({
    nurseUserId: userId,
    lat,
    lng,
  });
  return userId;
}

test.describe("Service Requests", () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test("patient request assigns to nearest nurse and shows current request details", async ({ page }) => {
    const nearNurseEmail = `near-nurse-${Date.now()}@test.local`;
    const farNurseEmail = `far-nurse-${Date.now()}@test.local`;
    const patientEmail = `patient-${Date.now()}@test.local`;

    const nearNurseId = await seedAvailableNurse(page, nearNurseEmail, "42.6629", "21.1655");
    await seedAvailableNurse(page, farNurseEmail, "40.0000", "20.0000");

    await createTestUser(page.request, patientEmail, "Test Patient", "patient");
    await markProfileComplete(patientEmail, { phone: "555-555-5555" });
    await loginTestUser(page.request, patientEmail);

    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "Request a Nurse Visit" })).toBeVisible();
    await expect(page.getByLabel("Visit type")).toHaveValue("same_day");
    await page.getByLabel("Address").fill("123 Test St, Pristina");
    await page.getByLabel("Care type").fill("Wellness check");

    await page.getByRole("button", { name: "Request Visit" }).click();

    const statusCard = page.getByTestId("patient-request-status-card");
    await expect(statusCard.getByText("Current request status")).toBeVisible({ timeout: 5000 });
    await expect(statusCard.getByText("Assigned to a nurse")).toBeVisible();
    await expect(statusCard.getByText("Wellness check")).toBeVisible();
    await expect(statusCard.getByText("Same day")).toBeVisible();

    const requestsResponse = await page.request.get("/api/requests/mine");
    const requests = await requestsResponse.json();
    expect(requests).toHaveLength(1);

    expect(requests[0].status).toBe("assigned");
    expect(requests[0].assignedNurseUserId).toBe(nearNurseId);
    expect(requests[0].requestType).toBe("same_day");
    expect(requests[0].careType).toBe("Wellness check");
  });

  test("scheduled request reveals scheduling fields and remains open when no nurses are available", async ({
    page,
  }) => {
    const patientEmail = `scheduled-patient-${Date.now()}@test.local`;
    await createTestUser(page.request, patientEmail, "Scheduled Patient", "patient");
    await markProfileComplete(patientEmail, { phone: "555-3000" });
    await loginTestUser(page.request, patientEmail);

    await page.goto("/dashboard");

    await page.getByLabel("Visit type").selectOption("scheduled");
    await expect(page.getByLabel("Scheduled for")).toBeVisible();
    await page.getByLabel("Scheduled for").fill("2026-04-20T09:30");
    await page.getByLabel("Address").fill("456 Remote St");
    await page.getByLabel("Care type").fill("Follow-up visit");

    await page.getByRole("button", { name: "Request Visit" }).click();

    const statusCard = page.getByTestId("patient-request-status-card");
    await expect(statusCard.getByText("Waiting for assignment")).toBeVisible({ timeout: 5000 });
    await expect(statusCard.getByText("Scheduled")).toBeVisible();
    await expect(statusCard.getByText("Follow-up visit")).toBeVisible();

    const requestsResponse = await page.request.get("/api/requests/mine");
    const requests = await requestsResponse.json();
    expect(requests).toHaveLength(1);

    expect(requests[0].status).toBe("open");
    expect(requests[0].assignedNurseUserId).toBeNull();
    expect(requests[0].requestType).toBe("scheduled");
    expect(requests[0].scheduledFor).toBeTruthy();
  });
});
