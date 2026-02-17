import { expect, test } from "@playwright/test";

import { resetDb, seedNurse, seedNurseLocation } from "../e2e-utils/db";
import { createTestUser, loginTestUser } from "../e2e-utils/helpers";

test.describe("Service Requests", () => {
    test.beforeEach(async () => {
        await resetDb();
    });

    test("patient request assigns to nearest nurse", async ({ page }) => {
        // Seed Nurse A (near) @ Pristina coordinates
        const nurseAEmail = `nurseA-${Date.now()}@test.local`;
        const { userId: nurseAId } = await createTestUser(page.request, nurseAEmail, "Nurse A", "nurse");

        await seedNurse({
            userId: nurseAId,
            licenseNumber: "RN-A123",
            specialization: "General",
            isAvailable: true,
        });

        await seedNurseLocation({
            nurseUserId: nurseAId,
            lat: "42.6629",
            lng: "21.1655",
        });

        // Seed Nurse B (far) @ different location
        const nurseBEmail = `nurseB-${Date.now()}@test.local`;
        const { userId: nurseBId } = await createTestUser(page.request, nurseBEmail, "Nurse B", "nurse");

        await seedNurse({
            userId: nurseBId,
            licenseNumber: "RN-B456",
            specialization: "General",
            isAvailable: true,
        });

        await seedNurseLocation({
            nurseUserId: nurseBId,
            lat: "40.0",
            lng: "20.0",
        });

        // Seed patient
        const patientEmail = `patient-${Date.now()}@test.local`;
        await createTestUser(page.request, patientEmail, "Test Patient", "patient");

        // Login as patient
        await loginTestUser(page.request, patientEmail);

        // Go to dashboard
        await page.goto("/dashboard");
        // Expect onboarding (since profile is incomplete) or complete logic
        // But for requests, we might need complete profile?
        // Let's check if dashboard access is allowed.
        // auth.spec.ts showed redirect to /onboarding.
        // If we are on onboarding, we can't create request.
        // We MUST complete profile for patient if required.
        // Assuming "complete profile" means basic fields or just accessing dashboard if not enforced strictly?
        // Wait, auth.spec.ts says "Should be authenticated and redirected to onboarding".
        // If requests.spec.ts needs dashboard, we need to bypass onboarding.
        // We can use DB to set profile_complete = true?
        // DB schema users.ts: `profileComplete: boolean("profile_complete").default(false)`.
        // I should update createTestUser or do it manually here.
        // I will do it manually here for now.
        const { getDbClient } = await import("../e2e-utils/db");
        const client = await import("../e2e-utils/db").then(m => m.getDbClient());
        await client.connect();
        try {
            const updateProfileQuery = `
                UPDATE users 
                SET first_name = 'Test', last_name = 'User', phone = '555-555-5555', city = 'Pristina', profile_completed_at = NOW() 
                WHERE email = $1
            `;
            await client.query(updateProfileQuery, [patientEmail]);
            await client.query(updateProfileQuery, [nurseAEmail]);
            await client.query(updateProfileQuery, [nurseBEmail]);
        } finally {
            await client.end();
        }

        // Now go to dashboard (should work)
        await page.goto("/dashboard");

        // Create request (near Nurse A)
        // Card is already visible
        await expect(page.locator("text=Request a Nurse Visit")).toBeVisible();
        await page.fill('#address', "123 Test St, Pristina");
        await page.fill('input[name="lat"]', "42.6629");
        await page.fill('input[name="lng"]', "21.1655");

        // Submit
        await page.click('button[type="submit"]');

        // Wait for success message or request card
        await expect(page.locator("text=assigned")).toBeVisible({ timeout: 5000 });

        // Verify request was assigned to Nurse A (nearest)
        // This could be done by checking the UI or making an API call
        const requestsResponse = await page.request.get("/api/requests/mine");
        const requests = await requestsResponse.json();

        expect(requests.length).toBeGreaterThan(0);
        expect(requests[0].status).toBe("assigned");
        expect(requests[0].assignedNurseUserId).toBe(nurseAId);

        // Login as Nurse A and verify they see the assignment
        // Logout first? loginTestUser calls sign-in which creates new session.
        // But cleaner to logout.
        await page.request.post("/api/auth/sign-out");

        await loginTestUser(page.request, nurseAEmail);

        await page.goto("/dashboard");

        // Verify assignment card shows the request
        await expect(page.locator("text=Current Assignment")).toBeVisible();
        await expect(page.locator("text=123 Test St, Pristina")).toBeVisible();
    });

    test("request stays open when no nurses available", async ({ page }) => {
        // Seed patient only (no nurses)
        const patientEmail = `patient-${Date.now()}@test.local`;
        await createTestUser(page.request, patientEmail, "Test Patient", "patient");

        // Update profile complete
        const { getDbClient } = await import("../e2e-utils/db");
        const client = await getDbClient();
        await client.connect();
        try {
            await client.query(`
                UPDATE users 
                SET first_name = 'Test', last_name = 'User', phone = '555-555-5555', city = 'Pristina', profile_completed_at = NOW() 
                WHERE email = $1
            `, [patientEmail]);
        } finally {
            await client.end();
        }

        // Login as patient
        await loginTestUser(page.request, patientEmail);

        // Go to dashboard
        await page.goto("/dashboard");

        // Create request
        await expect(page.locator("text=Request a Nurse Visit")).toBeVisible();
        await page.fill('#address', "456 Remote St");
        await page.fill('input[name="lat"]', "42.0");
        await page.fill('input[name="lng"]', "21.0");

        // Submit
        await page.click('button[type="submit"]');

        // Wait for request card
        await expect(page.locator("text=open")).toBeVisible({ timeout: 5000 });

        // Verify request status is "open"
        const requestsResponse = await page.request.get("/api/requests/mine");
        const requests = await requestsResponse.json();

        expect(requests.length).toBeGreaterThan(0);
        expect(requests[0].status).toBe("open");
        expect(requests[0].assignedNurseUserId).toBeNull();
    });
});
