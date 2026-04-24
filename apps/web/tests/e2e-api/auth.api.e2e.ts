import { expect, test } from "@playwright/test";

import { resetDb } from "../e2e-utils/db";
import { createTestUser, loginTestUser } from "../e2e-utils/helpers";

test.describe("Authentication API", () => {
    test.beforeEach(async () => {
        await resetDb();
    });

    test("signup creates user and session", async ({ request }) => {
        const email = `api-signup-${Date.now()}@test.local`;
        const password = "password123";
        const name = "API User";

        // 1. Sign Up
        const response = await request.post("/api/auth/sign-up/email", {
            data: {
                email,
                password,
                name,
            },
        });
        expect(response.ok()).toBeTruthy();

        // 2. Verify Session
        const meResponse = await request.get("/api/me");
        expect(meResponse.ok()).toBeTruthy();
        const me = await meResponse.json();
        expect(me.user).toBeTruthy();
        expect(me.user.email).toBe(email);
        expect(me.user.name).toBe(name);
    });

    test("existing user can login", async ({ request }) => {
        const email = `api-login-${Date.now()}@test.local`;
        const password = "password123";
        const name = "Login User";

        // Setup: Create user
        await request.post("/api/auth/sign-up/email", {
            data: { email, password, name },
        });
        await request.post("/api/auth/sign-out", { data: {} });

        // 1. Login
        const loginResponse = await request.post("/api/auth/sign-in/email", {
            data: { email, password },
        });
        expect(loginResponse.ok()).toBeTruthy();

        // 2. Verify Session
        const meResponse = await request.get("/api/me");
        expect(meResponse.ok()).toBeTruthy();
        const me = await meResponse.json();
        expect(me.user.email).toBe(email);
    });

    test("admin session reaches /api/me and /api/admin/ping", async ({ request }) => {
        const email = `api-auth-admin-${Date.now()}@test.local`;

        await createTestUser(request, email, "Auth Admin", "admin");
        await loginTestUser(request, email);

        const meResponse = await request.get("/api/me");
        expect(meResponse.ok()).toBeTruthy();
        const me = await meResponse.json();
        expect(me.user.email).toBe(email);
        expect(me.user.role).toBe("admin");

        const pingResponse = await request.get("/api/admin/ping");
        expect(pingResponse.ok()).toBeTruthy();
        const ping = await pingResponse.json();
        expect(ping).toMatchObject({
            ok: true,
            user: {
                role: "admin",
            },
        });

        const signOutResponse = await request.post("/api/auth/sign-out", { data: {} });
        expect(signOutResponse.ok()).toBeTruthy();
    });
});
