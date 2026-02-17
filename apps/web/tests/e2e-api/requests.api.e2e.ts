import { expect, test } from "@playwright/test";

import { resetDb, seedNurse, seedNurseLocation } from "../e2e-utils/db";
import { createTestUser, loginTestUser, markProfileComplete } from "../e2e-utils/helpers";

test.describe("Requests API", () => {
    test.setTimeout(60000); // DB ops + matching might be slow
    test.beforeEach(async () => {
        await resetDb();
    });

    test("create request assigns nearest nurse", async ({ request }) => {
        // 1. Setup Nurse
        const nurseEmail = `nurse-assign-${Date.now()}@test.local`;
        const { userId: nurseId } = await createTestUser(request, nurseEmail, "Nurse Assign", "nurse");
        await seedNurse({
            userId: nurseId,
            licenseNumber: "RN-ASSIGN",
            specialization: "General",
            isAvailable: true,
        });
        await seedNurseLocation({
            nurseUserId: nurseId,
            lat: "42.6629",
            lng: "21.1655", // Pristina
        });

        // 2. Setup Patient
        const patientEmail = `patient-req-${Date.now()}@test.local`;
        await createTestUser(request, patientEmail, "Patient Req", "patient");
        await markProfileComplete(patientEmail);

        await loginTestUser(request, patientEmail);

        // 3. Create Request
        const response = await request.post("/api/requests", {
            data: {
                address: "123 Test St, Pristina",
                lat: 42.6629,
                lng: 21.1655,
            },
        });
        expect(response.ok(), `Create request failed: ${await response.text()}`).toBeTruthy();
        const data = await response.json();

        // 4. Verify Assignment
        expect(data.status).toBe("assigned");
        expect(data.assignedNurseUserId).toBe(nurseId);
    });

    test("create request leaves open if no nurse", async ({ request }) => {
        // 1. Setup Patient
        const patientEmail = `patient-open-${Date.now()}@test.local`;
        await createTestUser(request, patientEmail, "Patient Open", "patient");

        await markProfileComplete(patientEmail);

        await loginTestUser(request, patientEmail);

        // 2. Create Request
        const response = await request.post("/api/requests", {
            data: {
                address: "456 Remote St",
                lat: 50.0,
                lng: 50.0,
            },
        });
        expect(response.ok(), `Create request failed: ${await response.text()}`).toBeTruthy();
        const data = await response.json();

        // 3. Verify Open
        expect(data.status).toBe("open");
        expect(data.assignedNurseUserId).toBeNull();
    });
});
