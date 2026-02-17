import { expect, test } from "@playwright/test";

import { resetDb } from "../e2e-utils/db";

test.describe("Authentication", () => {
    test.beforeEach(async () => {
        await resetDb();
    });

    test("patient signup redirects to onboarding", async ({ page }) => {
        // Visit signup page
        await page.goto("/signup");

        // Fill signup form
        const email = `patient-${Date.now()}@test.local`;
        await page.getByLabel("Email").fill(email);
        await page.getByLabel("Password").fill("password123");
        await page.getByLabel("Name").fill("Test Patient");

        // Submit
        await page.getByRole("button", { name: /sign up/i }).click();

        // Should redirect to onboarding or dashboard (which redirects to onboarding)
        await page.waitForURL(/\/(onboarding|dashboard)/);

        // If on dashboard, should redirect to onboarding
        if (page.url().includes("/dashboard")) {
            await page.waitForURL("/onboarding");
        }

        // Verify we're on onboarding page
        await expect(page).toHaveURL(/\/onboarding/);
    });

    test("existing user can login", async ({ page }) => {
        const email = `existing-${Date.now()}@test.local`;
        const password = "password123";
        const name = "Existing User";

        // 1. Create user via Sign Up API (REAL flow)
        // This creates auth_user, account, session, and domain user (via webhook/logic)
        const signUpResponse = await page.request.post("/api/auth/sign-up/email", {
            data: {
                email,
                password,
                name,
            },
        });
        expect(signUpResponse.ok()).toBeTruthy();

        // 2. Sign out to simulate "existing user not logged in" state
        await page.request.post("/api/auth/sign-out");

        // 3. Login using real API (instead of /api/test/login)
        const loginResponse = await page.request.post("/api/auth/sign-in/email", {
            data: {
                email,
                password,
            },
        });

        expect(loginResponse.ok()).toBeTruthy();

        // 4. Verify session is active via /api/me
        const meResponse = await page.request.get("/api/me");
        expect(meResponse.ok()).toBeTruthy();
        const meData = await meResponse.json();



        expect(meData.user).toBeTruthy();
        expect(meData.user.email).toBe(email);

        // 5. Navigate to dashboard (authenticated)
        await page.goto("/dashboard");

        // Should be authenticated and redirected to onboarding (since profile is incomplete)
        await expect(page).toHaveURL(/\/onboarding/);
    });
});
