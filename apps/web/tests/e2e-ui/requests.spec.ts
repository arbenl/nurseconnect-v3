import { expect, test } from "@playwright/test";

import { resetDb, seedNurse, seedNurseLocation } from "../e2e-utils/db";
import { createTestUser, loginTestUser, markProfileComplete } from "../e2e-utils/helpers";

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

        // Ensure users can access dashboard instead of onboarding.
        await markProfileComplete(patientEmail, { phone: "555-555-5555" });
        await markProfileComplete(nurseAEmail, { phone: "555-555-5555" });
        await markProfileComplete(nurseBEmail, { phone: "555-555-5555" });

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
        await page.request.post("/api/auth/sign-out", { data: {} });

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

        await markProfileComplete(patientEmail, { phone: "555-555-5555" });

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
