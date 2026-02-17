import { expect, test } from "@playwright/test";

import { resetDb, seedUser } from "./db";

test.describe("Onboarding", () => {
    test.beforeEach(async () => {
        await resetDb();
    });

    test("complete onboarding unlocks dashboard", async ({ page, request }) => {
        // Seed patient user (incomplete profile)
        const email = "patient@test.local";
        await seedUser({ email, role: "patient", displayName: "Test Patient" });

        // Login via test endpoint
        await request.post("/api/test/login", {
            data: { email },
        });

        // Visit dashboard - should redirect to onboarding
        await page.goto("/dashboard");
        await page.waitForURL("/onboarding");

        // Fill onboarding form (adjust selectors based on your actual form)
        await page.fill('input[name="phone"]', "+38344123456");
        await page.fill('textarea[name="address"]', "123 Test St, Pristina");

        // Submit onboarding
        await page.click('button[type="submit"]');

        // Should redirect to dashboard
        await page.waitForURL("/dashboard");
        await expect(page).toHaveURL("/dashboard");

        // Verify dashboard content is visible (not redirected back)
        await expect(page.locator("text=Dashboard")).toBeVisible();
    });
});
