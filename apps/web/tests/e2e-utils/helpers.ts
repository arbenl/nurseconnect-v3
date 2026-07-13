
import { APIRequestContext, expect } from "@playwright/test";
import { getDbClient } from "./db";
import { DEFAULT_ORGANIZATION_ID } from "./tenant";

export const TEST_PASSWORD = "password123";
export { DEFAULT_BRANCH_ID, DEFAULT_ORGANIZATION_ID } from "./tenant";

export async function createTestUser(
    request: APIRequestContext,
    email: string,
    name: string = "Test User",
    role: "patient" | "nurse" | "admin" | "referral_partner" = "patient"
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
        if (role === "admin") {
            await client.query(
                `INSERT INTO org_memberships
                    (organization_id, user_id, role, status, source, activated_at, created_at, updated_at)
                 VALUES ($1, $2, 'owner', 'active', 'bootstrap', NOW(), NOW(), NOW())
                 ON CONFLICT (organization_id, user_id)
                 DO NOTHING`,
                [DEFAULT_ORGANIZATION_ID, userId],
            );
        }

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

export async function markProfileComplete(
    email: string,
    overrides?: {
        firstName?: string;
        lastName?: string;
        phone?: string;
        city?: string;
    }
) {
    const firstName = overrides?.firstName ?? "Test";
    const lastName = overrides?.lastName ?? "User";
    const phone = overrides?.phone ?? "555";
    const city = overrides?.city ?? "Pristina";

    const client = getDbClient();
    await client.connect();
    try {
        await client.query(
            `UPDATE users
             SET first_name = $1,
                 last_name = $2,
                 phone = $3,
                 city = $4,
                 profile_completed_at = NOW()
             WHERE email = $5`,
            [firstName, lastName, phone, city, email]
        );
    } finally {
        await client.end();
    }
}
