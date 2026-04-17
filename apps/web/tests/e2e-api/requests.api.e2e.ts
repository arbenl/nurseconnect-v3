import { expect, test } from "@playwright/test";

import { getDbClient, resetDb, seedNurse, seedNurseLocation } from "../e2e-utils/db";
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

    test("create request does not assign a submitted nurse applicant", async ({ request }) => {
        const applicantEmail = `nurse-submitted-${Date.now()}@test.local`;
        const { userId: applicantUserId } = await createTestUser(
            request,
            applicantEmail,
            "Submitted Applicant",
            "patient",
        );
        await seedNurse({
            userId: applicantUserId,
            licenseNumber: "RN-SUBMITTED",
            specialization: "General",
            isAvailable: true,
            status: "submitted",
            licenseJurisdiction: "CA",
        });
        await seedNurseLocation({
            nurseUserId: applicantUserId,
            lat: "42.6629",
            lng: "21.1655",
        });

        const patientEmail = `patient-submitted-${Date.now()}@test.local`;
        await createTestUser(request, patientEmail, "Patient Submitted", "patient");
        await markProfileComplete(patientEmail);
        await loginTestUser(request, patientEmail);

        const response = await request.post("/api/requests", {
            data: {
                address: "Submitted Applicant Street",
                lat: 42.6629,
                lng: 21.1655,
            },
        });
        expect(response.ok(), `Create request failed: ${await response.text()}`).toBeTruthy();
        const data = await response.json();

        expect(data.status).toBe("open");
        expect(data.assignedNurseUserId).toBeNull();
    });

    test("create request does not assign a nurse with an expired license", async ({ request }) => {
        const nurseEmail = `nurse-expired-${Date.now()}@test.local`;
        const { userId: nurseId } = await createTestUser(request, nurseEmail, "Expired Nurse", "nurse");
        await seedNurse({
            userId: nurseId,
            licenseNumber: "RN-EXPIRED",
            specialization: "General",
            isAvailable: true,
            status: "verified",
            licenseJurisdiction: "CA",
            licenseValidUntil: "2020-01-01T00:00:00.000Z",
        });
        await seedNurseLocation({
            nurseUserId: nurseId,
            lat: "42.6629",
            lng: "21.1655",
        });

        const patientEmail = `patient-expired-${Date.now()}@test.local`;
        await createTestUser(request, patientEmail, "Patient Expired", "patient");
        await markProfileComplete(patientEmail);
        await loginTestUser(request, patientEmail);

        const response = await request.post("/api/requests", {
            data: {
                address: "Expired Nurse Street",
                lat: 42.6629,
                lng: 21.1655,
            },
        });
        expect(response.ok(), `Create request failed: ${await response.text()}`).toBeTruthy();
        const data = await response.json();

        expect(data.status).toBe("open");
        expect(data.assignedNurseUserId).toBeNull();
    });

    test("create request persists scheduling and referral intake fields", async ({ request }) => {
        const patientEmail = `patient-intake-${Date.now()}@test.local`;
        await createTestUser(request, patientEmail, "Patient Intake", "patient");
        await markProfileComplete(patientEmail);
        await loginTestUser(request, patientEmail);

        const response = await request.post("/api/requests", {
            data: {
                address: "789 Intake St, Pristina",
                lat: 42.6629,
                lng: 21.1655,
                requestType: "scheduled",
                scheduledFor: "2027-01-15T09:30:00.000Z",
                referralSource: "partner",
                referralPartnerId: null,
                careType: "wound_care",
            },
        });
        expect(response.ok(), `Create request failed: ${await response.text()}`).toBeTruthy();
        const data = await response.json();

        expect(data.requestType).toBe("scheduled");
        expect(data.scheduledFor).toBe("2027-01-15T09:30:00.000Z");
        expect(data.referralSource).toBe("partner");
        expect(data.referralPartnerId).toBeNull();
        expect(data.careType).toBe("wound_care");
    });

    test("create request rejects invalid request-type and scheduledFor combinations", async ({
        request,
    }) => {
        const patientEmail = `patient-invalid-intake-${Date.now()}@test.local`;
        await createTestUser(request, patientEmail, "Patient Invalid Intake", "patient");
        await markProfileComplete(patientEmail);
        await loginTestUser(request, patientEmail);

        const scheduledMissingTime = await request.post("/api/requests", {
            data: {
                address: "12 Invalid St, Pristina",
                lat: 42.6629,
                lng: 21.1655,
                requestType: "scheduled",
            },
        });

        expect(scheduledMissingTime.status()).toBe(400);
        await expect(scheduledMissingTime.json()).resolves.toEqual({
            message: "scheduledFor is required for scheduled requests",
        });

        const sameDayWithTime = await request.post("/api/requests", {
            data: {
                address: "13 Invalid St, Pristina",
                lat: 42.6629,
                lng: 21.1655,
                requestType: "same_day",
                scheduledFor: "2027-01-01T10:00:00.000Z",
            },
        });

        expect(sameDayWithTime.status()).toBe(400);
        await expect(sameDayWithTime.json()).resolves.toEqual({
            message: "scheduledFor must be omitted for same-day requests",
        });
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

    test("mine endpoint preserves patient-or-assigned semantics without a hard history cap", async ({
        request,
    }) => {
        const actorEmail = `mine-combined-${Date.now()}@test.local`;
        const { userId: actorUserId } = await createTestUser(request, actorEmail, "Mine Combined", "nurse");

        const client = getDbClient();
        await client.connect();
        try {
            const patientInsert = await client.query<{ id: string }>(
                `INSERT INTO users (email, role, name, created_at, updated_at)
                 VALUES ($1, 'patient', 'Mine Combined Patient', NOW(), NOW())
                 RETURNING id`,
                [`mine-combined-patient-${Date.now()}@test.local`],
            );
            const patientUserId = patientInsert.rows[0]!.id;

            const values: unknown[] = [];
            const placeholders: string[] = [];
            for (let index = 0; index < 52; index += 1) {
                const base = index * 9;
                values.push(
                    patientUserId,
                    actorUserId,
                    "completed",
                    `Assigned History ${index + 1}`,
                    "42.0",
                    "21.0",
                    new Date(Date.UTC(2026, 0, 1, 8, 0, index)).toISOString(),
                    new Date(Date.UTC(2026, 0, 1, 8, 0, index)).toISOString(),
                    new Date(Date.UTC(2026, 0, 1, 9, 0, index)).toISOString(),
                );
                placeholders.push(
                    `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`,
                );
            }

            await client.query(
                `INSERT INTO service_requests (
                    patient_user_id,
                    assigned_nurse_user_id,
                    status,
                    address,
                    lat,
                    lng,
                    created_at,
                    updated_at,
                    completed_at
                ) VALUES ${placeholders.join(", ")}`,
                values,
            );

            await client.query(
                `INSERT INTO service_requests (
                    patient_user_id,
                    assigned_nurse_user_id,
                    status,
                    address,
                    lat,
                    lng,
                    created_at,
                    updated_at
                ) VALUES ($1, NULL, 'open', $2, '42.5', '21.5', $3, $3)`,
                [
                    actorUserId,
                    "My Own Open Request",
                    "2026-02-01T08:00:00.000Z",
                ],
            );
        } finally {
            await client.end();
        }

        await loginTestUser(request, actorEmail);

        const mineResponse = await request.get("/api/requests/mine");
        expect(mineResponse.ok(), `Mine failed: ${await mineResponse.text()}`).toBeTruthy();
        const mine = await mineResponse.json();

        expect(mine).toHaveLength(53);
        expect(mine[0]?.address).toBe("My Own Open Request");
        expect(mine.at(-1)?.address).toBe("Assigned History 1");
    });

    test("location endpoint influences nearest nurse assignment", async ({ request }) => {
        const nearNurseEmail = `nurse-near-${Date.now()}@test.local`;
        const { userId: nearNurseId } = await createTestUser(request, nearNurseEmail, "Nurse Near", "nurse");
        await seedNurse({
            userId: nearNurseId,
            licenseNumber: "RN-NEAR",
            specialization: "General",
            isAvailable: true,
        });

        const farNurseEmail = `nurse-far-${Date.now()}@test.local`;
        const { userId: farNurseId } = await createTestUser(request, farNurseEmail, "Nurse Far", "nurse");
        await seedNurse({
            userId: farNurseId,
            licenseNumber: "RN-FAR",
            specialization: "General",
            isAvailable: true,
        });

        await loginTestUser(request, nearNurseEmail);
        const nearLocation = await request.patch("/api/me/location", {
            data: { lat: 42.6629, lng: 21.1655 },
        });
        expect(nearLocation.ok(), `Near location failed: ${await nearLocation.text()}`).toBeTruthy();

        await request.post("/api/auth/sign-out", { data: {} });
        await loginTestUser(request, farNurseEmail);
        const farLocation = await request.patch("/api/me/location", {
            data: { lat: 43.0000, lng: 21.9000 },
        });
        expect(farLocation.ok(), `Far location failed: ${await farLocation.text()}`).toBeTruthy();

        await request.post("/api/auth/sign-out", { data: {} });

        const patientEmail = `patient-location-${Date.now()}@test.local`;
        await createTestUser(request, patientEmail, "Patient Location", "patient");
        await markProfileComplete(patientEmail);
        await loginTestUser(request, patientEmail);

        const createResponse = await request.post("/api/requests", {
            data: {
                address: "10 Center St, Pristina",
                lat: 42.6629,
                lng: 21.1655,
            },
        });

        expect(createResponse.ok(), `Create request failed: ${await createResponse.text()}`).toBeTruthy();
        const created = await createResponse.json();
        expect(created.status).toBe("assigned");
        expect(created.assignedNurseUserId).toBe(nearNurseId);
    });

    test("events endpoint returns ordered timeline", async ({ request }) => {
        const nurseEmail = `timeline-nurse-${Date.now()}@test.local`;
        const { userId: nurseId } = await createTestUser(
            request,
            nurseEmail,
            "Timeline Nurse",
            "nurse"
        );
        await seedNurse({
            userId: nurseId,
            licenseNumber: "RN-TL",
            specialization: "General",
            isAvailable: true,
        });
        await seedNurseLocation({
            nurseUserId: nurseId,
            lat: "42.6629",
            lng: "21.1655",
        });

        const patientEmail = `timeline-patient-${Date.now()}@test.local`;
        await createTestUser(request, patientEmail, "Timeline Patient", "patient");
        await markProfileComplete(patientEmail);

        await loginTestUser(request, patientEmail);
        const createResponse = await request.post("/api/requests", {
            data: {
                address: "11 Center St, Pristina",
                lat: 42.6629,
                lng: 21.1655,
            },
        });
        expect(createResponse.ok(), `Create request failed: ${await createResponse.text()}`).toBeTruthy();
        const created = await createResponse.json();
        expect(created.status).toBe("assigned");

        await request.post("/api/auth/sign-out", { data: {} });
        await loginTestUser(request, nurseEmail);
        const acceptResponse = await request.post(`/api/requests/${created.id}/accept`);
        expect(acceptResponse.ok(), `Accept failed: ${await acceptResponse.text()}`).toBeTruthy();

        await request.post("/api/auth/sign-out", { data: {} });
        await loginTestUser(request, patientEmail);
        const eventsResponse = await request.get(`/api/requests/${created.id}/events`);
        expect(eventsResponse.ok(), `Get events failed: ${await eventsResponse.text()}`).toBeTruthy();
        const events = await eventsResponse.json();

        expect(Array.isArray(events)).toBe(true);
        expect(events.map((event: { type: string }) => event.type)).toEqual([
            "request_created",
            "request_assigned",
            "request_accepted",
        ]);
    });
});
