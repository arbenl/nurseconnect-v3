import { expect, test } from "@playwright/test";

import { resetDb, seedNurse, seedNurseLocation } from "../e2e-utils/db";
import { createTestUser, loginTestUser, markProfileComplete } from "../e2e-utils/helpers";

test.describe("Nurse Features", () => {
    test.beforeEach(async () => {
        await resetDb();
    });

    test("applicant dashboard explains the review state after nurse application", async ({ page }) => {
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
        const applicationStatusCard = page.getByTestId("nurse-application-status-card");
        await expect(applicationStatusCard.getByText("Application Under Review")).toBeVisible();
        await expect(
            applicationStatusCard.getByText(
                "You can still request care as a patient while we review your credentials.",
            ),
        ).toBeVisible();
        await expect(
            applicationStatusCard.getByText(
                "Nurse access will only be enabled after license verification is complete.",
            ),
        ).toBeVisible();
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

    test("nurse dashboard shows operational context without overstating dispatch behavior", async ({ page }) => {
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

        const statusCard = page.getByTestId("nurse-status-card");
        const assignmentCard = page.getByTestId("nurse-assignment-card");

        await expect(statusCard.getByText("Dispatch availability")).toBeVisible();
        await expect(statusCard.getByText("You can receive new visit requests right now.")).toBeVisible();
        await expect(statusCard.getByText("Availability does not guarantee an assignment.")).toBeVisible();
        await expect(assignmentCard.getByText("No active visit right now")).toBeVisible();
        await expect(
            assignmentCard.getByText(
                "Stay available and keep your phone nearby. New visit requests will appear here.",
            ),
        ).toBeVisible();
        await expect(assignmentCard.getByText("Pediatrics")).toBeVisible();
        await expect(page.getByText("visible to patients in your area.")).toHaveCount(0);
    });
});
