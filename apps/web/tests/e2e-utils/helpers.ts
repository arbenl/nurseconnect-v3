
import { APIRequestContext, expect } from "@playwright/test";

import { getDbClient } from "./db";

export const TEST_PASSWORD = "password123";

export async function createTestUser(
    request: APIRequestContext,
    email: string,
    name: string = "Test User",
    role: "patient" | "nurse" | "admin" = "patient"
) {
    // 1. Sign Up (creates user + session)
    const signUpResponse = await request.post("/api/auth/sign-up/email", {
        data: {
            email,
            password: TEST_PASSWORD,
            name,
        },
    });
    expect(signUpResponse.ok(), `Sign up failed for ${email}`).toBeTruthy();
    const signUpData = await signUpResponse.json();
    const authUserId = signUpData.user.id; // Better-Auth text ID

    // 2. Ensure Domain User exists (sync from session)
    const me = await request.get("/api/me");
    expect(me.ok(), `Sync domain user failed for ${email}`).toBeTruthy();

    // 3. Sign Out (to clear session and allow fresh login if needed)
    await request.post("/api/auth/sign-out", { data: {} });

    // 4. Update Role + fetch domain UUID
    const client = getDbClient();
    await client.connect();
    try {
        if (role !== "patient") {
            await client.query("UPDATE users SET role = $1 WHERE email = $2", [role, email]);
        }

        // Fetch domain user ID (UUID) — always needed
        const res = await client.query("SELECT id FROM users WHERE email = $1", [email]);
        const userId = res.rows[0].id as string;

        return { userId, authUserId };
    } finally {
        await client.end();
    }
}

export async function loginTestUser(request: APIRequestContext, email: string) {
    const loginResponse = await request.post("/api/auth/sign-in/email", {
        data: {
            email,
            password: TEST_PASSWORD,
        },
    });
    expect(loginResponse.ok(), `Login failed for ${email}`).toBeTruthy();
}
