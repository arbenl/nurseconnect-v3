import { expect, test } from "@playwright/test";

import { resetDb, seedNurse, seedNurseLocation } from "../e2e-utils/db";
import { createTestUser, loginTestUser, markProfileComplete } from "../e2e-utils/helpers";

test.describe("Nurse Features", () => {
    test.beforeEach(async () => {
        await resetDb();
    });

    test("patient can apply to join as a nurse and sees under-review state", async ({ page }) => {
        // Seed patient user
        const email = `future-nurse-${Date.now()}@test.local`;
        await createTestUser(page.request, email, "Future Nurse", "patient");

        // Login via test endpoint
        await loginTestUser(page.request, email);

        await markProfileComplete(email, { phone: "555-555-5555" });

        // 1. Prove we are on dashboard
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(page).toHaveURL(/\/dashboard/);

        // 2. Verify /api/me state
        const me = await page.request.get("/api/me");
        expect(me.ok()).toBeTruthy();
        const meJson = await me.json();
        expect(meJson.user?.role).toBe("patient");

        // 3. Wait for dashboard to be ready
        await expect(page.getByTestId("dashboard-loading")).toHaveCount(0);
        await expect(page.getByTestId("dashboard-ready")).toBeVisible();

        // 4. Check if application card is visible using stable selector
        await expect(page.getByTestId("become-nurse-card")).toBeVisible();

        // Fill nurse application form
        await page.fill('input[name="licenseNumber"]', "RN-12345");
        await page.fill('input[name="licenseJurisdiction"]', "CA");
        await page.fill('input[name="specialization"]', "General Care");

        // Submit application
        await page.getByRole("button", { name: "Submit Application" }).click();

        // Application card should be replaced by an under-review state
        await expect(page.getByText("Application Under Review")).toBeVisible();
        await expect(page.getByTestId("become-nurse-card")).toHaveCount(0);
        await expect(page.locator("text=Availability Status")).toHaveCount(0);

        // Verify via API that applicant is still a patient with a submitted nurse profile
        const response = await page.request.get("/api/me");
        const data = await response.json();

        expect(data.user.role).toBe("patient");
        expect(data.user.nurseProfile).toMatchObject({
            status: "submitted",
            licenseNumber: "RN-12345",
            licenseJurisdiction: "CA",
            specialization: "General Care",
            isAvailable: false,
        });
    });

    test("nurse can see their location on dashboard", async ({ page }) => {
        // Seed nurse user with location
        const email = `nurse-${Date.now()}@test.local`;
        const { userId } = await createTestUser(page.request, email, "Test Nurse", "nurse");

        await seedNurse({
            userId,
            licenseNumber: "RN-99999",
            specialization: "Pediatrics",
            isAvailable: true,
        });

        await seedNurseLocation({
            nurseUserId: userId,
            lat: "42.6629",
            lng: "21.1655",
        });

        await markProfileComplete(email, { lastName: "Nurse", phone: "555-555-5555" });

        // Login
        await loginTestUser(page.request, email);

        // Go to dashboard
        await page.goto("/dashboard");

        // Verify nurse info is visible
        await expect(page.locator("text=Availability Status")).toBeVisible();
        await expect(page.locator("text=Pediatrics")).toBeVisible();
    });
});
