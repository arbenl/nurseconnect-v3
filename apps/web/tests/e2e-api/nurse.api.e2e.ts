import { expect, test } from "@playwright/test";

import { resetDb } from "../e2e-utils/db";
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
        await request.post("/api/auth/sign-out");
        await loginTestUser(request, email);

        // 2. Verify Role Update via /api/me
        const meResponse = await request.get("/api/me");
        const me = await meResponse.json();
        expect(me.user.role).toBe("nurse");
        expect(me.user.nurseProfile).toBeTruthy();
        expect(me.user.nurseProfile.licenseNumber).toBe("RN-API-TEST");
        expect(me.user.nurseProfile.isAvailable).toBe(false); // Default
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
        await request.post("/api/auth/sign-out");
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
});
