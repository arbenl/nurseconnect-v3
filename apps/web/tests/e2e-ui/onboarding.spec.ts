import { expect, test } from "@playwright/test";

import { resetDb } from "../e2e-utils/db";
import { createTestUser, loginTestUser } from "../e2e-utils/helpers";

test.describe("Onboarding", () => {
    test.beforeEach(async () => {
        await resetDb();
    });

    test("complete onboarding unlocks dashboard", async ({ page }) => {
        // Seed patient user (incomplete profile)
        const email = `patient-${Date.now()}@test.local`;
        await createTestUser(page.request, email, "Test Patient", "patient");

        // Login via test endpoint
        await loginTestUser(page.request, email);

        // Visit dashboard - should redirect to onboarding
        await page.goto("/dashboard");
        await page.waitForURL(/\/onboarding/);

        await expect(page.getByLabel("First Name")).toBeVisible();

        await page.getByLabel("First Name").fill("Test");
        await page.getByLabel("Last Name").fill("Patient");
        await page.getByLabel("Phone Number").fill("+38344123456");
        await page.getByLabel("City").fill("Pristina");
        await page.getByLabel("Address (Optional)").fill("123 Test St, Pristina");

        // Submit onboarding
        await page.getByRole("button", { name: "Save and Continue" }).click();

        // Should redirect to dashboard
        await page.waitForURL(/\/dashboard/);
        await expect(page).toHaveURL(/\/dashboard/);

        // Verify dashboard content is visible (not redirected back)
        await expect(page.locator("text=Dashboard")).toBeVisible();
    });
});
