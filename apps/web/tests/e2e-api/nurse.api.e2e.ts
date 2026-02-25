import { expect, test } from "@playwright/test";

import { getDbClient, resetDb, seedNurse } from "../e2e-utils/db";
import { createTestUser, loginTestUser } from "../e2e-utils/helpers";

test.describe("Nurse API", () => {
    test.beforeEach(async () => {
        await resetDb();
    });

    test("user can become a nurse", async ({ request }) => {
        const email = `become-nurse-${Date.now()}@test.local`;
        await createTestUser(request, email, "Future Nurse", "patient");
        await loginTestUser(request, email);

        // 1. Become Nurse
        const response = await request.post("/api/me/become-nurse", {
            data: {
                licenseNumber: "RN-API-TEST",
                specialization: "Emergency",
            },
        });
        expect(response.ok()).toBeTruthy();

        // Refresh session to get new role
        await request.post("/api/auth/sign-out", { data: {} });
        await loginTestUser(request, email);

        // 2. Verify Role Update via /api/me
        const meResponse = await request.get("/api/me");
        const me = await meResponse.json();
        expect(me.user.role).toBe("nurse");
        expect(me.user.nurseProfile).toBeTruthy();
        expect(me.user.nurseProfile.licenseNumber).toBe("RN-API-TEST");
        expect(me.user.nurseProfile.isAvailable).toBe(false); // Default
    });

    test("become nurse is idempotent and keeps one nurse profile row", async ({ request }) => {
        const email = `become-nurse-idempotent-${Date.now()}@test.local`;
        const { userId } = await createTestUser(request, email, "Idempotent Nurse", "patient");
        await loginTestUser(request, email);

        const first = await request.post("/api/me/become-nurse", {
            data: {
                licenseNumber: "RN-IDEMP-1",
                specialization: "Emergency",
            },
        });
        expect(first.ok(), `First become-nurse failed: ${await first.text()}`).toBeTruthy();

        const second = await request.post("/api/me/become-nurse", {
            data: {
                licenseNumber: "RN-IDEMP-2",
                specialization: "ICU",
            },
        });
        expect(second.ok(), `Second become-nurse failed: ${await second.text()}`).toBeTruthy();

        await request.post("/api/auth/sign-out", { data: {} });
        await loginTestUser(request, email);

        const meResponse = await request.get("/api/me");
        expect(meResponse.ok(), `Me fetch failed: ${await meResponse.text()}`).toBeTruthy();
        const me = await meResponse.json();
        expect(me.user.role).toBe("nurse");
        expect(me.user.nurseProfile.licenseNumber).toBe("RN-IDEMP-2");
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

    test("nurse can toggle availability", async ({ request }) => {
        const email = `toggle-nurse-${Date.now()}@test.local`;
        await createTestUser(request, email, "Toggle Nurse", "patient");
        await loginTestUser(request, email);

        // Become Nurse first
        await request.post("/api/me/become-nurse", {
            data: { licenseNumber: "RN-TOGGLE", specialization: "ICU" },
        });

        // Refresh session
        await request.post("/api/auth/sign-out", { data: {} });
        await loginTestUser(request, email);

        // 1. Toggle ON
        const toggleOn = await request.patch("/api/me/nurse", {
            data: { isAvailable: true },
        });
        expect(toggleOn.ok()).toBeTruthy();

        // Verify
        const check1 = await request.get("/api/me");
        const data1 = await check1.json();
        expect(data1.user.nurseProfile.isAvailable).toBe(true);

        // 2. Toggle OFF
        const toggleOff = await request.patch("/api/me/nurse", {
            data: { isAvailable: false },
        });
        expect(toggleOff.ok()).toBeTruthy();

        // Verify
        const check2 = await request.get("/api/me");
        const data2 = await check2.json();
        expect(data2.user.nurseProfile.isAvailable).toBe(false);
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
