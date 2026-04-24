import { db, schema, sql } from "@nurseconnect/database";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getVerifiedAndAvailableNurseCount } from "./credential-lifecycle";

const { nurses, users } = schema;

describe.sequential("nurse credential lifecycle read models", () => {
  beforeAll(async () => {
    await db.execute(sql`SELECT 1`);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE service_request_events RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE admin_audit_logs RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE service_requests RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nurse_locations RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nurses RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  });

  it("counts only nurses that are both verified and available", async () => {
    const insertedUsers = await db
      .insert(users)
      .values([
        { email: "verified-available@test.local", role: "nurse" },
        { email: "verified-unavailable@test.local", role: "nurse" },
        { email: "available-submitted@test.local", role: "patient" },
      ])
      .returning();

    await db.insert(nurses).values([
      {
        userId: insertedUsers[0]!.id,
        status: "verified",
        licenseNumber: "RN-VA-001",
        licenseJurisdiction: "CA",
        specialization: "ICU",
        licenseValidUntil: new Date("2027-12-31T00:00:00.000Z"),
        isAvailable: true,
      },
      {
        userId: insertedUsers[1]!.id,
        status: "verified",
        licenseNumber: "RN-VU-001",
        licenseJurisdiction: "CA",
        specialization: "Emergency",
        licenseValidUntil: new Date("2027-12-31T00:00:00.000Z"),
        isAvailable: false,
      },
      {
        userId: insertedUsers[2]!.id,
        status: "submitted",
        licenseNumber: "RN-AS-001",
        licenseJurisdiction: "CA",
        specialization: "General",
        isAvailable: true,
      },
    ]);

    await expect(getVerifiedAndAvailableNurseCount()).resolves.toBe(1);
  });
});
