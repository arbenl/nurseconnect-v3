import { expect, test } from "@playwright/test";

import { getDbClient, resetDb, seedNurse } from "../e2e-utils/db";
import { createTestUser, loginTestUser } from "../e2e-utils/helpers";

test.describe("Nurse API", () => {
    test.beforeEach(async () => {
        await resetDb();
    });

    test("patient can submit a nurse application without being promoted", async ({ request }) => {
        const email = `become-nurse-${Date.now()}@test.local`;
        await createTestUser(request, email, "Future Nurse", "patient");
        await loginTestUser(request, email);

        const response = await request.post("/api/me/become-nurse", {
            data: {
                licenseNumber: "RN-API-TEST",
                licenseJurisdiction: "CA",
                specialization: "Emergency",
            },
        });
        expect(response.ok()).toBeTruthy();
        await expect(response.json()).resolves.toMatchObject({
            ok: true,
            status: "submitted",
        });

        const meResponse = await request.get("/api/me");
        expect(meResponse.ok()).toBeTruthy();
        const me = await meResponse.json();

        expect(me.user.role).toBe("patient");
        expect(me.user.nurseProfile).toMatchObject({
            status: "submitted",
            licenseNumber: "RN-API-TEST",
            licenseJurisdiction: "CA",
            specialization: "Emergency",
            isAvailable: false,
            licenseValidUntil: null,
        });
    });

    test("nurse application is idempotent and keeps one nurse profile row", async ({ request }) => {
        const email = `become-nurse-idempotent-${Date.now()}@test.local`;
        const { userId } = await createTestUser(request, email, "Idempotent Nurse", "patient");
        await loginTestUser(request, email);

        const first = await request.post("/api/me/become-nurse", {
            data: {
                licenseNumber: "RN-IDEMP-1",
                licenseJurisdiction: "CA",
                specialization: "Emergency",
            },
        });
        expect(first.ok(), `First become-nurse failed: ${await first.text()}`).toBeTruthy();

        const second = await request.post("/api/me/become-nurse", {
            data: {
                licenseNumber: "RN-IDEMP-2",
                licenseJurisdiction: "NY",
                specialization: "ICU",
            },
        });
        expect(second.ok(), `Second become-nurse failed: ${await second.text()}`).toBeTruthy();

        const meResponse = await request.get("/api/me");
        expect(meResponse.ok(), `Me fetch failed: ${await meResponse.text()}`).toBeTruthy();
        const me = await meResponse.json();

        expect(me.user.role).toBe("patient");
        expect(me.user.nurseProfile.status).toBe("submitted");
        expect(me.user.nurseProfile.licenseNumber).toBe("RN-IDEMP-2");
        expect(me.user.nurseProfile.licenseJurisdiction).toBe("NY");
        expect(me.user.nurseProfile.specialization).toBe("ICU");

        const client = getDbClient();
        await client.connect();
        try {
            const countResult = await client.query<{ count: string }>(
                "SELECT COUNT(*)::text AS count FROM nurses WHERE user_id = $1",
                [userId]
            );
            const nurseCount = Number(countResult.rows[0]?.count ?? "0");
            expect(nurseCount).toBe(1);
        } finally {
            await client.end();
        }
    });

    test("submitted applicants cannot toggle nurse availability", async ({ request }) => {
        const email = `toggle-applicant-${Date.now()}@test.local`;
        await createTestUser(request, email, "Toggle Applicant", "patient");
        await loginTestUser(request, email);

        const application = await request.post("/api/me/become-nurse", {
            data: {
                licenseNumber: "RN-TOGGLE-APPLY",
                licenseJurisdiction: "CA",
                specialization: "ICU",
            },
        });
        expect(application.ok(), `Application failed: ${await application.text()}`).toBeTruthy();

        const toggle = await request.patch("/api/me/nurse", {
            data: { isAvailable: true },
        });
        expect(toggle.status()).toBe(403);
    });

    test("verified nurses can toggle availability", async ({ request }) => {
        const email = `toggle-verified-${Date.now()}@test.local`;
        const { userId } = await createTestUser(request, email, "Toggle Nurse", "nurse");
        await seedNurse({
            userId,
            licenseNumber: "RN-TOGGLE-VERIFIED",
            specialization: "ICU",
            isAvailable: false,
            status: "verified",
            licenseJurisdiction: "CA",
            licenseValidUntil: "2027-12-31T00:00:00.000Z",
        });
        await loginTestUser(request, email);

        const toggleOn = await request.patch("/api/me/nurse", {
            data: { isAvailable: true },
        });
        expect(toggleOn.ok(), `Toggle on failed: ${await toggleOn.text()}`).toBeTruthy();

        const check1 = await request.get("/api/me");
        const data1 = await check1.json();
        expect(data1.user.nurseProfile.isAvailable).toBe(true);

        const toggleOff = await request.patch("/api/me/nurse", {
            data: { isAvailable: false },
        });
        expect(toggleOff.ok(), `Toggle off failed: ${await toggleOff.text()}`).toBeTruthy();

        const check2 = await request.get("/api/me");
        const data2 = await check2.json();
        expect(data2.user.nurseProfile.isAvailable).toBe(false);
    });

    test("verified nurses cannot mark themselves available while an active visit is assigned", async ({ request }) => {
        const nurseEmail = `toggle-active-${Date.now()}@test.local`;
        const patientEmail = `toggle-active-patient-${Date.now()}@test.local`;

        const { userId: nurseUserId } = await createTestUser(request, nurseEmail, "Busy Nurse", "nurse");
        const { userId: patientUserId } = await createTestUser(request, patientEmail, "Busy Patient", "patient");

        await seedNurse({
            userId: nurseUserId,
            licenseNumber: "RN-TOGGLE-BUSY",
            specialization: "ICU",
            isAvailable: false,
            status: "verified",
            licenseJurisdiction: "CA",
            licenseValidUntil: "2027-12-31T00:00:00.000Z",
        });

        const client = getDbClient();
        await client.connect();
        try {
            await client.query(
                `INSERT INTO service_requests
                  (patient_user_id, assigned_nurse_user_id, status, address, lat, lng, request_type, created_at, updated_at, assigned_at)
                 VALUES
                  ($1, $2, 'assigned', '123 Active Visit', '42.662900', '21.165500', 'same_day', NOW(), NOW(), NOW())`,
                [patientUserId, nurseUserId],
            );
        } finally {
            await client.end();
        }

        await loginTestUser(request, nurseEmail);

        const toggleOn = await request.patch("/api/me/nurse", {
            data: { isAvailable: true },
        });

        expect(toggleOn.status()).toBe(409);
        await expect(toggleOn.json()).resolves.toMatchObject({
            error: "Conflict: Nurse has an active visit",
        });
    });

    test("nurse route does not create a missing nurse profile", async ({ request }) => {
        const email = `toggle-missing-profile-${Date.now()}@test.local`;
        const { userId } = await createTestUser(request, email, "Missing Profile Nurse", "nurse");
        await loginTestUser(request, email);

        const response = await request.patch("/api/me/nurse", {
            data: { isAvailable: true },
        });
        expect(response.status()).toBe(404);

        const client = getDbClient();
        await client.connect();
        try {
            const countResult = await client.query<{ count: string }>(
                "SELECT COUNT(*)::text AS count FROM nurses WHERE user_id = $1",
                [userId],
            );
            expect(Number(countResult.rows[0]?.count ?? "0")).toBe(0);
        } finally {
            await client.end();
        }
    });

    test("forbids location updates for non-nurse users", async ({ request }) => {
        const email = `location-patient-${Date.now()}@test.local`;
        await createTestUser(request, email, "Location Patient", "patient");
        await loginTestUser(request, email);

        const response = await request.patch("/api/me/location", {
            data: {
                lat: 42.6629,
                lng: 21.1655,
            },
        });

        expect(response.status()).toBe(403);
    });

    test("nurse can set location", async ({ request }) => {
        const email = `location-nurse-${Date.now()}@test.local`;
        const { userId } = await createTestUser(request, email, "Location Nurse", "nurse");
        await seedNurse({
            userId,
            licenseNumber: "RN-LOC-API",
            specialization: "General",
            isAvailable: true,
        });
        await loginTestUser(request, email);

        const response = await request.patch("/api/me/location", {
            data: {
                lat: 42.6629,
                lng: 21.1655,
            },
        });

        expect(response.ok(), `Location update failed: ${await response.text()}`).toBeTruthy();
        const body = await response.json();
        expect(body.ok).toBe(true);
        expect(body.throttled).toBe(false);
        expect(typeof body.lastUpdated).toBe("string");
    });
});
