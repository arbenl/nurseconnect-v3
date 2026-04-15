import { expect, test } from "@playwright/test";

import { getDbClient, resetDb, seedNurse, seedNurseLocation } from "../e2e-utils/db";
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

    test("nurse dashboard shows only assigned work, not patient requests owned by the nurse account", async ({
        page,
    }) => {
        const nurseEmail = `nurse-feed-${Date.now()}@test.local`;
        const patientEmail = `nurse-feed-patient-${Date.now()}@test.local`;
        const otherNurseEmail = `nurse-feed-other-${Date.now()}@test.local`;

        const { userId: nurseUserId } = await createTestUser(page.request, nurseEmail, "Mixed Nurse", "nurse");
        const { userId: patientUserId } = await createTestUser(page.request, patientEmail, "Assigned Patient", "patient");
        const { userId: otherNurseUserId } = await createTestUser(
            page.request,
            otherNurseEmail,
            "Other Nurse",
            "nurse",
        );

        await seedNurse({
            userId: nurseUserId,
            licenseNumber: "RN-FEED-001",
            specialization: "General",
            isAvailable: true,
            status: "verified",
            licenseJurisdiction: "XK",
            licenseValidUntil: new Date(Date.now() + 86_400_000).toISOString(),
        });

        await seedNurse({
            userId: otherNurseUserId,
            licenseNumber: "RN-FEED-002",
            specialization: "General",
            isAvailable: true,
            status: "verified",
            licenseJurisdiction: "XK",
            licenseValidUntil: new Date(Date.now() + 86_400_000).toISOString(),
        });

        await markProfileComplete(nurseEmail, { phone: "555-2111" });
        await loginTestUser(page.request, nurseEmail);

        const client = getDbClient();
        await client.connect();
        try {
            await client.query(
                `INSERT INTO service_requests
                  (patient_user_id, assigned_nurse_user_id, status, address, lat, lng, request_type, care_type, created_at, updated_at, assigned_at)
                 VALUES
                  ($1, $2, 'assigned', 'My own patient visit', '42.662900', '21.165500', 'same_day', 'Own request', NOW(), NOW(), NOW()),
                  ($3, $1, 'assigned', 'Assigned patient visit', '42.650000', '21.170000', 'same_day', 'Assigned request', NOW() - interval '5 minutes', NOW() - interval '5 minutes', NOW() - interval '5 minutes')`,
                [nurseUserId, otherNurseUserId, patientUserId],
            );
        } finally {
            await client.end();
        }

        await page.goto("/dashboard");

        const assignmentCard = page.getByTestId("nurse-assignment-card");
        await expect(assignmentCard.getByText("Assigned patient visit")).toBeVisible();
        await expect(assignmentCard.getByText("Assigned request")).toBeVisible();
        await expect(assignmentCard.getByText("My own patient visit")).toHaveCount(0);
    });

    test("nurse dashboard pauses availability while an active visit is in progress", async ({ page }) => {
        const nurseEmail = `nurse-active-visit-${Date.now()}@test.local`;
        const patientEmail = `nurse-active-visit-patient-${Date.now()}@test.local`;

        const { userId: nurseUserId } = await createTestUser(page.request, nurseEmail, "Active Visit Nurse", "nurse");
        const { userId: patientUserId } = await createTestUser(page.request, patientEmail, "Active Visit Patient", "patient");

        await seedNurse({
            userId: nurseUserId,
            licenseNumber: "RN-ACTIVE-001",
            specialization: "General",
            isAvailable: false,
            status: "verified",
            licenseJurisdiction: "XK",
            licenseValidUntil: new Date(Date.now() + 86_400_000).toISOString(),
        });

        await markProfileComplete(nurseEmail, { phone: "555-2222" });
        await loginTestUser(page.request, nurseEmail);

        const client = getDbClient();
        await client.connect();
        try {
            await client.query(
                `INSERT INTO service_requests
                  (patient_user_id, assigned_nurse_user_id, status, address, lat, lng, request_type, care_type, created_at, updated_at, assigned_at, accepted_at)
                 VALUES
                  ($1, $2, 'accepted', 'In-progress visit', '42.662900', '21.165500', 'same_day', 'Wellness check', NOW(), NOW(), NOW(), NOW())`,
                [patientUserId, nurseUserId],
            );
        } finally {
            await client.end();
        }

        await page.goto("/dashboard");

        const statusCard = page.getByTestId("nurse-status-card");
        await expect(statusCard.getByText("Availability is paused while you finish your active visit.")).toBeVisible();
        await expect(statusCard.getByText("Availability resumes after you complete or reject the visit.")).toBeVisible();
        await expect(statusCard.getByRole("switch")).toBeDisabled();
    });

    test("expired nurse sees blocked supply status instead of dispatch controls", async ({ page }) => {
        const email = `expired-nurse-${Date.now()}@test.local`;
        const { userId } = await createTestUser(page.request, email, "Expired Nurse", "nurse");

        await seedNurse({
            userId,
            licenseNumber: "RN-EXPIRED-001",
            specialization: "General",
            isAvailable: false,
            status: "expired",
            licenseJurisdiction: "XK",
            licenseValidUntil: new Date(Date.now() - 86_400_000).toISOString(),
        });

        await markProfileComplete(email, { phone: "555-2323" });
        await loginTestUser(page.request, email);
        await page.goto("/dashboard");

        await expect(page.getByTestId("nurse-application-status-card")).toBeVisible();
        await expect(page.getByText("License Expired")).toBeVisible();
        await expect(page.getByTestId("nurse-status-card")).toHaveCount(0);
        await expect(page.getByTestId("nurse-assignment-card")).toHaveCount(0);
    });
});
