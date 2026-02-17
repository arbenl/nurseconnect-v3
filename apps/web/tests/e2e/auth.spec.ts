import { expect, test } from "@playwright/test";

import { resetDb, seedUser } from "./db";

test.describe("Authentication", () => {
    test.beforeEach(async () => {
        await resetDb();
    });

    test("patient signup redirects to onboarding", async ({ page }) => {
        // Visit signup page
        await page.goto("/signup");

        // Fill signup form
        const email = `patient-${Date.now()}@test.local`;
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', "password123");
        await page.fill('input[name="displayName"]', "Test Patient");

        // Submit
        await page.click('button[type="submit"]');

        // Should redirect to onboarding or dashboard (which redirects to onboarding)
        await page.waitForURL(/\/(onboarding|dashboard)/);

        // If on dashboard, should redirect to onboarding
        if (page.url().includes("/dashboard")) {
            await page.waitForURL("/onboarding");
        }

        // Verify we're on onboarding page
        await expect(page).toHaveURL(/\/onboarding/);
    });

    test("existing user can login", async ({ page, request }) => {
        // Seed user
        const email = "existing@test.local";
        await seedUser({ email, role: "patient", displayName: "Existing User" });

        // Use test login endpoint
        const response = await request.post("/api/test/login", {
            data: { email },
        });

        expect(response.ok()).toBeTruthy();

        // Navigate to dashboard
        await page.goto("/dashboard");

        // Should be authenticated (not redirected to login)
        await expect(page).toHaveURL(/\/dashboard/);
    });
});
