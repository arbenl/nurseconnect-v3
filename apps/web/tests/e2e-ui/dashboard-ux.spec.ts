import { expect, test, type Page } from "@playwright/test";

import { resetDb, seedNurse } from "../e2e-utils/db";
import { createTestUser, loginTestUser, markProfileComplete } from "../e2e-utils/helpers";

async function seedPatient(page: Page, email: string) {
  await createTestUser(page.request, email, "Patient User", "patient");
  await markProfileComplete(email, { phone: "555-1000" });
}

async function seedVerifiedNurse(page: Page, email: string) {
  const { userId } = await createTestUser(page.request, email, "Nurse User", "nurse");
  await markProfileComplete(email, { phone: "555-2000" });
  await seedNurse({
    userId,
    status: "verified",
    licenseNumber: "RN-UX-001",
    licenseJurisdiction: "XK",
    specialization: "Home Care",
    isAvailable: true,
    licenseValidUntil: new Date(Date.now() + 86_400_000).toISOString(),
  });
}

test.describe("Dashboard UX", () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test("patient shell removes placeholder navigation and shows patient portal label", async ({
    page,
  }) => {
    const patientEmail = `patient-shell-${Date.now()}@test.local`;
    await seedPatient(page, patientEmail);

    await loginTestUser(page.request, patientEmail);
    await page.goto("/dashboard");

    await expect(page.getByTestId("dashboard-ready")).toBeVisible();
    await expect(page.getByTestId("app-shell-role")).toHaveText("Patient Portal");
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Schedule" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Patients" })).toHaveCount(0);
    await expect(page.locator('a[href="#"]')).toHaveCount(0);
    await expect(page.getByText("User Details")).toHaveCount(0);
    await expect(page.locator("pre")).toHaveCount(0);
  });

  test("nurse shell removes placeholder navigation and shows nurse portal label", async ({
    page,
  }) => {
    const nurseEmail = `nurse-shell-${Date.now()}@test.local`;
    await seedVerifiedNurse(page, nurseEmail);

    await loginTestUser(page.request, nurseEmail);
    await page.goto("/dashboard");

    await expect(page.getByTestId("dashboard-ready")).toBeVisible();
    await expect(page.getByTestId("app-shell-role")).toHaveText("Nurse Portal");
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Schedule" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Patients" })).toHaveCount(0);
    await expect(page.locator('a[href="#"]')).toHaveCount(0);
    await expect(page.getByText("User Details")).toHaveCount(0);
    await expect(page.locator("pre")).toHaveCount(0);
  });

  test("nurse dashboard copy stays operationally precise", async ({ page }) => {
    const nurseEmail = `nurse-dashboard-${Date.now()}@test.local`;
    await seedVerifiedNurse(page, nurseEmail);

    await loginTestUser(page.request, nurseEmail);
    await page.goto("/dashboard");

    await expect(page.getByText("Dispatch availability")).toBeVisible();
    await expect(page.getByText("Availability does not guarantee an assignment.")).toBeVisible();
    await expect(page.getByText("visible to patients in your area.")).toHaveCount(0);
    await expect(page.getByText("hidden from search results.")).toHaveCount(0);
  });

  test("mobile shell avoids dead bottom-nav links", async ({ page }) => {
    const patientEmail = `patient-mobile-shell-${Date.now()}@test.local`;
    await seedPatient(page, patientEmail);

    await loginTestUser(page.request, patientEmail);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");

    await expect(page.getByTestId("dashboard-ready")).toBeVisible();
    await expect(page.getByTestId("app-shell-role")).toHaveText("Patient Portal");
    await expect(page.getByRole("link", { name: "Schedule" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Patients" })).toHaveCount(0);
    await expect(page.locator('a[href="#"]')).toHaveCount(0);
  });
});
