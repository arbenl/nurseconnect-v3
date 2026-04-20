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
        const tables = [
            "nurse_payouts",
            "payment_authorizations",
            "service_request_events",
            "admin_audit_logs",
            "service_requests",
            "referral_partners",
            "nurse_locations",
            "nurses",
            "service_areas",
            "users",
            "auth_sessions",
            "auth_accounts",
            "auth_users",
        ] as const;

        for (const table of tables) {
            const result = await client.query<{ regclass: string | null }>(
                "SELECT to_regclass($1) AS regclass",
                [`public.${table}`],
            );
            if (!result.rows[0]?.regclass) {
                continue;
            }
            await client.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
        }

        await client.query(
            `INSERT INTO service_areas
                (label, center_lat, center_lng, radius_meters, status, created_at, updated_at)
             VALUES
                ('Pristina Test Coverage', '42.662900', '21.165500', 100000, 'active', NOW(), NOW()),
                ('Far Test Coverage', '40.000000', '20.000000', 100000, 'active', NOW(), NOW()),
                ('Remote Test Coverage', '50.000000', '50.000000', 100000, 'active', NOW(), NOW())`,
        );
    } finally {
        await client.end();
    }
}

/**
 * Seed a user and return the user ID.
 */
export async function seedUser(params: {
    email: string;
    role: "patient" | "nurse" | "admin" | "referral_partner";
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
    status?: "draft" | "submitted" | "under_review" | "verified" | "rejected" | "suspended" | "expired" | "renewal_pending";
    licenseJurisdiction?: string | null;
    licenseValidUntil?: string | Date | null;
}) {
    const client = getDbClient();
    await client.connect();

    try {
        await client.query(
            `INSERT INTO nurses (
                user_id,
                status,
                license_number,
                license_jurisdiction,
                specialization,
                license_valid_until,
                is_available
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                params.userId,
                params.status ?? "verified",
                params.licenseNumber,
                params.licenseJurisdiction ?? null,
                params.specialization,
                params.licenseValidUntil ? new Date(params.licenseValidUntil) : null,
                params.isAvailable,
            ]
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
    serviceAreaId?: string | null;
}) {
    const client = getDbClient();
    await client.connect();

    try {
        const serviceAreaId =
            params.serviceAreaId !== undefined
                ? params.serviceAreaId
                : (
                      await client.query<{ id: string }>(
                          `SELECT id
                             FROM service_areas
                            WHERE status = 'active'
                            ORDER BY
                              POWER(center_lat::double precision - $1::double precision, 2) +
                              POWER(center_lng::double precision - $2::double precision, 2) ASC,
                              label ASC
                            LIMIT 1`,
                          [params.lat, params.lng],
                      )
                  ).rows[0]?.id ?? null;

        await client.query(
            `INSERT INTO nurse_locations (nurse_user_id, lat, lng, service_area_id)
             VALUES ($1, $2, $3, $4)`,
            [params.nurseUserId, params.lat, params.lng, serviceAreaId]
        );
    } finally {
        await client.end();
    }
}

/**
 * Seed a referral partner profile.
 */
export async function seedReferralPartnerProfile(params: {
    userId: string;
    organizationName: string;
    status?: "active" | "inactive";
}) {
    const client = getDbClient();
    await client.connect();

    try {
        await client.query(
            `INSERT INTO referral_partners (user_id, organization_name, status, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())`,
            [params.userId, params.organizationName, params.status ?? "active"]
        );
    } finally {
        await client.end();
    }
}
