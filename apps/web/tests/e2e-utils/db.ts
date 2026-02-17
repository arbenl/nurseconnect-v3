import { Client } from "pg";

const DATABASE_URL =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/nurseconnect_test";

/**
 * Get a new pg client for E2E test DB operations.
 */
export function getDbClient() {
    return new Client({ connectionString: DATABASE_URL });
}

/**
 * Reset database by truncating all tables in dependency-safe order.
 */
export async function resetDb() {
    const client = getDbClient();
    await client.connect();

    try {
        await client.query("TRUNCATE TABLE service_requests RESTART IDENTITY CASCADE");
        await client.query("TRUNCATE TABLE nurse_locations RESTART IDENTITY CASCADE");
        await client.query("TRUNCATE TABLE nurses RESTART IDENTITY CASCADE");
        await client.query("TRUNCATE TABLE users RESTART IDENTITY CASCADE");
        await client.query("TRUNCATE TABLE auth_sessions RESTART IDENTITY CASCADE");
        await client.query("TRUNCATE TABLE auth_accounts RESTART IDENTITY CASCADE");
        await client.query("TRUNCATE TABLE auth_users RESTART IDENTITY CASCADE");
    } finally {
        await client.end();
    }
}

/**
 * Seed a user and return the user ID.
 */
export async function seedUser(params: {
    email: string;
    role: "patient" | "nurse" | "admin";
    displayName?: string;
}) {
    const client = getDbClient();
    await client.connect();

    try {
        const authUserId = `test-auth-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const name = params.displayName || params.email.split("@")[0];

        // 1. Insert into auth_users
        await client.query(
            `INSERT INTO auth_users (id, email, name, email_verified, created_at, updated_at)
             VALUES ($1, $2, $3, true, NOW(), NOW())`,
            [authUserId, params.email, name]
        );

        // 2. Insert into users (domain) linked to auth_user
        const result = await client.query(
            `INSERT INTO users (email, role, name, auth_id, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, NOW(), NOW()) 
             RETURNING id`,
            [params.email, params.role, name, authUserId]
        );
        return result.rows[0].id as string;
    } finally {
        await client.end();
    }
}

/**
 * Seed a nurse record.
 */
export async function seedNurse(params: {
    userId: string;
    licenseNumber: string;
    specialization: string;
    isAvailable: boolean;
}) {
    const client = getDbClient();
    await client.connect();

    try {
        await client.query(
            `INSERT INTO nurses (user_id, status, license_number, specialization, is_available) 
       VALUES ($1, 'verified', $2, $3, $4)`,
            [params.userId, params.licenseNumber, params.specialization, params.isAvailable]
        );
    } finally {
        await client.end();
    }
}

/**
 * Seed a nurse location.
 */
export async function seedNurseLocation(params: {
    nurseUserId: string;
    lat: string;
    lng: string;
}) {
    const client = getDbClient();
    await client.connect();

    try {
        await client.query(
            `INSERT INTO nurse_locations (nurse_user_id, lat, lng) 
       VALUES ($1, $2, $3)`,
            [params.nurseUserId, params.lat, params.lng]
        );
    } finally {
        await client.end();
    }
}
