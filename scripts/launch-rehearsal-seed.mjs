#!/usr/bin/env node

import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const requireFromWeb = createRequire(resolve(repoRoot, "apps/web/package.json"));
const { Client } = requireFromWeb("pg");

const DEFAULT_APP_URL = "http://localhost:3000";
const PASSWORD = "password123";

const seedUsers = [
  {
    key: "admin",
    email: "launch.admin@test.local",
    name: "Launch Admin",
    role: "admin",
  },
  {
    key: "nurse",
    email: "launch.nurse@test.local",
    name: "Launch Nurse",
    role: "nurse",
  },
  {
    key: "patient",
    email: "launch.patient@test.local",
    name: "Launch Patient",
    role: "patient",
  },
  {
    key: "partner",
    email: "launch.partner@test.local",
    name: "Launch Partner",
    role: "referral_partner",
  },
];

function loadLocalEnv() {
  const candidates = [
    resolve(repoRoot, ".env"),
    resolve(repoRoot, ".env.local"),
    resolve(repoRoot, "apps/web/.env"),
    resolve(repoRoot, "apps/web/.env.local"),
  ];

  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const parsed = dotenv.parse(readFileSync(file));
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof process.env[key] === "undefined") {
        process.env[key] = value;
      }
    }
  }
}

function getDatabaseName(databaseUrl) {
  try {
    return new URL(databaseUrl).pathname.replace(/^\//, "");
  } catch {
    return "";
  }
}

function assertSafeDatabase(databaseUrl) {
  const dbName = getDatabaseName(databaseUrl);
  if (!dbName) {
    throw new Error("Could not parse database name from DATABASE_URL.");
  }

  if (/(ci|test|gate|dev|local|rehearsal|staging)/i.test(dbName)) {
    return dbName;
  }

  if (process.env.I_KNOW_WHAT_I_AM_DOING === "1") {
    console.warn(
      `DANGER: I_KNOW_WHAT_I_AM_DOING=1 set. Seeding non-test database '${dbName}'.`,
    );
    return dbName;
  }

  throw new Error(
    `Refusing to seed non-test database '${dbName}'. Use a DATABASE_URL containing ci, test, gate, dev, local, rehearsal, or staging.`,
  );
}

async function queryOne(client, text, values = []) {
  const result = await client.query(text, values);
  return result.rows[0] ?? null;
}

async function ensureServiceArea(client) {
  const existing = await queryOne(
    client,
    "SELECT id FROM service_areas WHERE label = $1 LIMIT 1",
    ["Pristina Launch Rehearsal"],
  );

  if (existing) {
    await client.query(
      `UPDATE service_areas
          SET center_lat = $2,
              center_lng = $3,
              radius_meters = $4,
              status = 'active',
              updated_at = NOW()
        WHERE id = $1`,
      [existing.id, "42.662900", "21.165500", 15000],
    );
    return { id: existing.id, created: false };
  }

  const inserted = await queryOne(
    client,
    `INSERT INTO service_areas
        (label, center_lat, center_lng, radius_meters, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
     RETURNING id`,
    ["Pristina Launch Rehearsal", "42.662900", "21.165500", 15000],
  );
  return { id: inserted.id, created: true };
}

async function signUpViaApp(appUrl, user) {
  const response = await fetch(`${appUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: user.email,
      password: PASSWORD,
      name: user.name,
    }),
  });

  if (response.status === 409 || response.status === 422) {
    return { created: false };
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Sign-up failed for ${user.email}: ${response.status} ${body}`);
  }

  const cookie = response.headers.get("set-cookie");
  if (cookie) {
    await fetch(`${appUrl}/api/me`, {
      headers: { cookie },
    });
  }

  return { created: true };
}

async function ensureDomainUser(client, user, authCreated) {
  const existing = await queryOne(
    client,
    "SELECT id FROM users WHERE email = $1 LIMIT 1",
    [user.email],
  );

  if (existing) {
    await client.query(
      `UPDATE users
          SET role = $2,
              name = $3,
              first_name = $4,
              last_name = $5,
              phone = $6,
              city = $7,
              profile_completed_at = COALESCE(profile_completed_at, NOW()),
              updated_at = NOW()
        WHERE id = $1`,
      [
        existing.id,
        user.role,
        user.name,
        user.name.split(" ")[0],
        user.name.split(" ").slice(1).join(" ") || "User",
        "+38344111000",
        "Pristina",
      ],
    );
    return { id: existing.id, created: false, authCreated };
  }

  const authUser = await queryOne(
    client,
    "SELECT id FROM auth_users WHERE email = $1 LIMIT 1",
    [user.email],
  );
  const authId = authUser?.id ?? `launch-${user.key}`;

  if (!authUser) {
    await client.query(
      `INSERT INTO auth_users (id, email, name, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [authId, user.email, user.name],
    );
  }

  const inserted = await queryOne(
    client,
    `INSERT INTO users
        (email, role, name, auth_id, first_name, last_name, phone, city, profile_completed_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NOW())
     RETURNING id`,
    [
      user.email,
      user.role,
      user.name,
      authId,
      user.name.split(" ")[0],
      user.name.split(" ").slice(1).join(" ") || "User",
      "+38344111000",
      "Pristina",
    ],
  );

  return { id: inserted.id, created: true, authCreated };
}

async function ensureNurse(client, nurseUserId, adminUserId, serviceAreaId) {
  const existing = await queryOne(
    client,
    "SELECT id FROM nurses WHERE user_id = $1 LIMIT 1",
    [nurseUserId],
  );

  if (existing) {
    await client.query(
      `UPDATE nurses
          SET status = 'verified',
              phone = '+38344111222',
              license_number = 'RN-LAUNCH-001',
              license_jurisdiction = 'Kosovo',
              specialization = 'Home care',
              license_valid_until = NOW() + INTERVAL '1 year',
              verified_by = $2,
              verified_at = COALESCE(verified_at, NOW()),
              is_available = true,
              updated_at = NOW()
        WHERE user_id = $1`,
      [nurseUserId, adminUserId],
    );
  } else {
    await client.query(
      `INSERT INTO nurses
          (user_id, status, phone, license_number, license_jurisdiction, specialization,
           license_valid_until, verified_by, verified_at, is_available, created_at, updated_at)
       VALUES ($1, 'verified', '+38344111222', 'RN-LAUNCH-001', 'Kosovo', 'Home care',
           NOW() + INTERVAL '1 year', $2, NOW(), true, NOW(), NOW())`,
      [nurseUserId, adminUserId],
    );
  }

  await client.query(
    `INSERT INTO nurse_locations (nurse_user_id, lat, lng, service_area_id, last_updated)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (nurse_user_id)
     DO UPDATE SET lat = EXCLUDED.lat,
                   lng = EXCLUDED.lng,
                   service_area_id = EXCLUDED.service_area_id,
                   last_updated = NOW()`,
    [nurseUserId, "42.662900", "21.165500", serviceAreaId],
  );
}

async function ensurePartner(client, partnerUserId) {
  const existing = await queryOne(
    client,
    "SELECT id FROM referral_partners WHERE user_id = $1 LIMIT 1",
    [partnerUserId],
  );

  if (existing) {
    await client.query(
      `UPDATE referral_partners
          SET organization_name = 'Launch Clinic',
              status = 'active',
              updated_at = NOW()
        WHERE user_id = $1`,
      [partnerUserId],
    );
    return;
  }

  await client.query(
    `INSERT INTO referral_partners (user_id, organization_name, status, created_at, updated_at)
     VALUES ($1, 'Launch Clinic', 'active', NOW(), NOW())`,
    [partnerUserId],
  );
}

function printSummary({ appUrl, dbName, serviceArea, users }) {
  console.log("Launch rehearsal seed complete");
  console.log("");
  console.log(`Database: ${dbName}`);
  console.log(`App URL:  ${appUrl}`);
  console.log("");
  console.log("Service area");
  console.log(`- Pristina Launch Rehearsal (${serviceArea.id})`);
  console.log("");
  console.log("Users");
  console.log("Role              Email                         Password");
  console.log("----------------  ----------------------------  ----------");
  for (const user of users) {
    console.log(`${user.role.padEnd(16)}  ${user.email.padEnd(28)}  ${PASSWORD}`);
  }
  console.log("");
  console.log("Next: follow docs/runbooks/launch_readiness_review.md from Manual Launch Rehearsal step 7.");
}

async function main() {
  loadLocalEnv();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const dbName = assertSafeDatabase(databaseUrl);
  const appUrl = (process.env.APP_URL || process.env.BETTER_AUTH_URL || DEFAULT_APP_URL).replace(/\/$/, "");

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const serviceArea = await ensureServiceArea(client);
    const userResults = [];

    for (const user of seedUsers) {
      let authResult = { created: false };
      const existing = await queryOne(client, "SELECT id FROM users WHERE email = $1 LIMIT 1", [
        user.email,
      ]);
      if (!existing) {
        authResult = await signUpViaApp(appUrl, user);
      }
      const domainUser = await ensureDomainUser(client, user, authResult.created);
      userResults.push({ ...user, ...domainUser });
    }

    const admin = userResults.find((user) => user.key === "admin");
    const nurse = userResults.find((user) => user.key === "nurse");
    const partner = userResults.find((user) => user.key === "partner");

    await ensureNurse(client, nurse.id, admin.id, serviceArea.id);
    await ensurePartner(client, partner.id);

    printSummary({
      appUrl,
      dbName,
      serviceArea,
      users: userResults,
    });
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Launch rehearsal seed failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
