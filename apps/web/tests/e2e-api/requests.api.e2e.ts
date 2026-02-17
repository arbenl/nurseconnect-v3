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

    test("full flow: assigned nurse accepts and patient sees accepted", async ({ request }) => {
        const nurseEmail = `nurse-accept-${Date.now()}@test.local`;
        const { userId: nurseId } = await createTestUser(request, nurseEmail, "Nurse Accept", "nurse");
        await seedNurse({
            userId: nurseId,
            licenseNumber: "RN-ACCEPT",
            specialization: "General",
            isAvailable: true,
        });
        await seedNurseLocation({
            nurseUserId: nurseId,
            lat: "42.6629",
            lng: "21.1655",
        });

        const patientEmail = `patient-accept-${Date.now()}@test.local`;
        await createTestUser(request, patientEmail, "Patient Accept", "patient");
        await markProfileComplete(patientEmail);

        await loginTestUser(request, patientEmail);
        const createResponse = await request.post("/api/requests", {
            data: {
                address: "7 Main St, Pristina",
                lat: 42.6629,
                lng: 21.1655,
            },
        });
        expect(createResponse.ok(), `Create request failed: ${await createResponse.text()}`).toBeTruthy();
        const created = await createResponse.json();
        expect(created.status).toBe("assigned");

        await request.post("/api/auth/sign-out", { data: {} });
        await loginTestUser(request, nurseEmail);

        const acceptResponse = await request.post(`/api/requests/${created.id}/accept`, { data: {} });
        expect(acceptResponse.ok(), `Accept failed: ${await acceptResponse.text()}`).toBeTruthy();
        const accepted = await acceptResponse.json();
        expect(accepted.request.status).toBe("accepted");

        await request.post("/api/auth/sign-out", { data: {} });
        await loginTestUser(request, patientEmail);

        const mineResponse = await request.get("/api/requests/mine");
        expect(mineResponse.ok(), `Mine failed: ${await mineResponse.text()}`).toBeTruthy();
        const mine = await mineResponse.json();
        const latest = mine[0];
        expect(latest.id).toBe(created.id);
        expect(latest.status).toBe("accepted");
    });

    test("reject flow: assigned nurse rejects and request reopens", async ({ request }) => {
        const nurseEmail = `nurse-reject-${Date.now()}@test.local`;
        const { userId: nurseId } = await createTestUser(request, nurseEmail, "Nurse Reject", "nurse");
        await seedNurse({
            userId: nurseId,
            licenseNumber: "RN-REJECT",
            specialization: "General",
            isAvailable: true,
        });
        await seedNurseLocation({
            nurseUserId: nurseId,
            lat: "42.6629",
            lng: "21.1655",
        });

        const patientEmail = `patient-reject-${Date.now()}@test.local`;
        await createTestUser(request, patientEmail, "Patient Reject", "patient");
        await markProfileComplete(patientEmail);

        await loginTestUser(request, patientEmail);
        const createResponse = await request.post("/api/requests", {
            data: {
                address: "9 Main St, Pristina",
                lat: 42.6629,
                lng: 21.1655,
            },
        });
        expect(createResponse.ok(), `Create request failed: ${await createResponse.text()}`).toBeTruthy();
        const created = await createResponse.json();
        expect(created.status).toBe("assigned");

        await request.post("/api/auth/sign-out", { data: {} });
        await loginTestUser(request, nurseEmail);

        const rejectResponse = await request.post(`/api/requests/${created.id}/reject`, {
            data: { reason: "Unable to reach address in time" },
        });
        expect(rejectResponse.ok(), `Reject failed: ${await rejectResponse.text()}`).toBeTruthy();
        const rejected = await rejectResponse.json();
        expect(rejected.request.status).toBe("open");
        expect(rejected.request.assignedNurseUserId).toBeNull();

        await request.post("/api/auth/sign-out", { data: {} });
        await loginTestUser(request, patientEmail);

        const mineResponse = await request.get("/api/requests/mine");
        expect(mineResponse.ok(), `Mine failed: ${await mineResponse.text()}`).toBeTruthy();
        const mine = await mineResponse.json();
        const latest = mine[0];
        expect(latest.id).toBe(created.id);
        expect(latest.status).toBe("open");
    });
});
