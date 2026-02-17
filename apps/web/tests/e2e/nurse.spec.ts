import { expect, test } from "@playwright/test";

import { resetDb, seedNurse, seedNurseLocation, seedUser } from "./db";

test.describe("Nurse Features", () => {
    test.beforeEach(async () => {
        await resetDb();
    });

    test("become nurse and toggle availability", async ({ page, request }) => {
        // Seed patient user
        const email = "patient@test.local";
        const _userId = await seedUser({ email, role: "patient", displayName: "Future Nurse" });

        // Login via test endpoint
        await request.post("/api/test/login", {
            data: { email },
        });

        // Go to dashboard
        await page.goto("/dashboard");

        // Click "Become a nurse" button
        await page.click('text="Become a nurse"');

        // Fill nurse onboarding form
        await page.fill('input[name="licenseNumber"]', "RN-12345");
        await page.fill('input[name="specialization"]', "General Care");

        // Submit
        await page.click('button[type="submit"]');

        // Wait for nurse card to appear
        await expect(page.locator("text=Nurse Status")).toBeVisible();

        // Toggle availability ON
        await page.click('[data-testid="availability-toggle"]');

        // Verify via API that isAvailable is true
        const response = await request.get("/api/me");
        const data = await response.json();

        expect(data.nurse?.isAvailable).toBe(true);
    });

    test("nurse can see their location on dashboard", async ({ page, request }) => {
        // Seed nurse user with location
        const email = "nurse@test.local";
        const userId = await seedUser({ email, role: "nurse", displayName: "Test Nurse" });

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

        // Login
        await request.post("/api/test/login", {
            data: { email },
        });

        // Go to dashboard
        await page.goto("/dashboard");

        // Verify nurse info is visible
        await expect(page.locator("text=Nurse Status")).toBeVisible();
        await expect(page.locator("text=Pediatrics")).toBeVisible();
    });
});
