import { expect, test } from "@playwright/test";

import { resetDb, seedNurse, seedNurseLocation, seedUser } from "./db";

test.describe("Service Requests", () => {
    test.beforeEach(async () => {
        await resetDb();
    });

    test("patient request assigns to nearest nurse", async ({ page, request }) => {
        // Seed Nurse A (near) @ Pristina coordinates
        const nurseAEmail = "nurseA@test.local";
        const nurseAId = await seedUser({
            email: nurseAEmail,
            role: "nurse",
            displayName: "Nurse A",
        });

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
        const nurseBEmail = "nurseB@test.local";
        const nurseBId = await seedUser({
            email: nurseBEmail,
            role: "nurse",
            displayName: "Nurse B",
        });

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
        const patientEmail = "patient@test.local";
        await seedUser({
            email: patientEmail,
            role: "patient",
            displayName: "Test Patient",
        });

        // Login as patient
        await request.post("/api/test/login", {
            data: { email: patientEmail },
        });

        // Go to dashboard
        await page.goto("/dashboard");

        // Create request (near Nurse A)
        await page.click('text="Request a Visit"');
        await page.fill('input[name="address"]', "123 Test St, Pristina");
        await page.fill('input[name="lat"]', "42.6629");
        await page.fill('input[name="lng"]', "21.1655");

        // Submit
        await page.click('button[type="submit"]');

        // Wait for success message or request card
        await expect(page.locator("text=assigned")).toBeVisible({ timeout: 5000 });

        // Verify request was assigned to Nurse A (nearest)
        // This could be done by checking the UI or making an API call
        const requestsResponse = await request.get("/api/requests/mine");
        const requests = await requestsResponse.json();

        expect(requests.length).toBeGreaterThan(0);
        expect(requests[0].status).toBe("assigned");
        expect(requests[0].assignedNurseUserId).toBe(nurseAId);

        // Login as Nurse A and verify they see the assignment
        await request.post("/api/test/login", {
            data: { email: nurseAEmail },
        });

        await page.goto("/dashboard");

        // Verify assignment card shows the request
        await expect(page.locator("text=New Assignment")).toBeVisible();
        await expect(page.locator("text=123 Test St, Pristina")).toBeVisible();
    });

    test("request stays open when no nurses available", async ({ page, request }) => {
        // Seed patient only (no nurses)
        const patientEmail = "patient@test.local";
        await seedUser({
            email: patientEmail,
            role: "patient",
            displayName: "Test Patient",
        });

        // Login as patient
        await request.post("/api/test/login", {
            data: { email: patientEmail },
        });

        // Go to dashboard
        await page.goto("/dashboard");

        // Create request
        await page.click('text="Request a Visit"');
        await page.fill('input[name="address"]', "456 Remote St");
        await page.fill('input[name="lat"]', "42.0");
        await page.fill('input[name="lng"]', "21.0");

        // Submit
        await page.click('button[type="submit"]');

        // Wait for request card
        await expect(page.locator("text=open")).toBeVisible({ timeout: 5000 });

        // Verify request status is "open"
        const requestsResponse = await request.get("/api/requests/mine");
        const requests = await requestsResponse.json();

        expect(requests.length).toBeGreaterThan(0);
        expect(requests[0].status).toBe("open");
        expect(requests[0].assignedNurseUserId).toBeNull();
    });
});
