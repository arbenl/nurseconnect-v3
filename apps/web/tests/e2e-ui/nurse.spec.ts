import { expect, test } from "@playwright/test";

import { resetDb, seedNurse, seedNurseLocation } from "../e2e-utils/db";
import { createTestUser, loginTestUser } from "../e2e-utils/helpers";

test.describe("Nurse Features", () => {
    test.beforeEach(async () => {
        await resetDb();
    });

    test("become nurse and toggle availability", async ({ page }) => {
        // Seed patient user
        const email = `future-nurse-${Date.now()}@test.local`;
        await createTestUser(page.request, email, "Future Nurse", "patient");

        // Login via test endpoint
        await loginTestUser(page.request, email);

        // Go to dashboard (redirects to onboarding if incomplete)
        // We need profile complete to see dashboard?
        // Or "Become a nurse" is part of onboarding or dashboard?
        // Usually dashboard. So we need profile complete.
        const { getDbClient } = await import("../e2e-utils/db");
        const client = await getDbClient();
        await client.connect();
        try {
            await client.query(`
                UPDATE users 
                SET first_name = 'Test', last_name = 'User', phone = '555-555-5555', city = 'Pristina', profile_completed_at = NOW() 
                WHERE email = $1
            `, [email]);
        } finally {
            await client.end();
        }

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

        // 4. Check if Become a Nurse card is visible using stable selector
        await expect(page.getByTestId("become-nurse-card")).toBeVisible();

        // Fill nurse onboarding form
        await page.fill('input[name="licenseNumber"]', "RN-12345");
        await page.fill('input[name="specialization"]', "General Care");

        // Submit
        await page.click('button[type="submit"]');

        // Wait for nurse card to appear
        await expect(page.locator("text=Availability Status")).toBeVisible();

        // Toggle availability ON
        await page.getByRole("switch", { name: "Toggle availability" }).click();

        // Verify via API that isAvailable is true
        // Use page.request
        const response = await page.request.get("/api/me");
        const data = await response.json();

        expect(data.nurse?.isAvailable).toBe(true);
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

        // Set profile complete
        const { getDbClient } = await import("../e2e-utils/db");
        const client = await import("../e2e-utils/db").then(m => m.getDbClient()); // lazy import
        await client.connect();
        try {
            await client.query(`
                UPDATE users 
                SET first_name = 'Test', last_name = 'Nurse', phone = '555-555-5555', city = 'Pristina', profile_completed_at = NOW() 
                WHERE email = $1
            `, [email]);
        } finally {
            await client.end();
        }

        // Login
        await loginTestUser(page.request, email);

        // Go to dashboard
        await page.goto("/dashboard");

        // Verify nurse info is visible
        await expect(page.locator("text=Availability Status")).toBeVisible();
        await expect(page.locator("text=Pediatrics")).toBeVisible();
    });
});
