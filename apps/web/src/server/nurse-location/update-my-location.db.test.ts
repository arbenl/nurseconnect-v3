import { db, eq, schema, sql } from "@nurseconnect/database";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { NurseLocationForbiddenError, updateMyNurseLocation } from "./update-my-location";

const { users, nurses, nurseLocations } = schema;

describe.sequential("updateMyNurseLocation", () => {
  beforeAll(async () => {
    await db.execute(sql`SELECT 1`);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE service_requests RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nurse_locations RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nurses RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  });

  it("creates a nurse location on first update", async () => {
    const [nurseUser] = await db
      .insert(users)
      .values({ email: "location-first@test.local", role: "nurse" })
      .returning();

    await db.insert(nurses).values({
      userId: nurseUser!.id,
      status: "verified",
      isAvailable: true,
      licenseNumber: "RN-LOC-1",
      specialization: "General",
    });

    const result = await updateMyNurseLocation({
      actorUserId: nurseUser!.id,
      lat: 42.6629,
      lng: 21.1655,
    });

    expect(result.ok).toBe(true);
    expect(result.throttled).toBe(false);

    const [stored] = await db
      .select()
      .from(nurseLocations)
      .where(eq(nurseLocations.nurseUserId, nurseUser!.id));

    expect(stored).toBeTruthy();
    expect(Number(stored!.lat)).toBeCloseTo(42.6629, 6);
    expect(Number(stored!.lng)).toBeCloseTo(21.1655, 6);
    expect(stored!.lastUpdated).toBeTruthy();
  });

  it("throttles immediate second update and keeps previous coordinates", async () => {
    const [nurseUser] = await db
      .insert(users)
      .values({ email: "location-throttle@test.local", role: "nurse" })
      .returning();

    await db.insert(nurses).values({
      userId: nurseUser!.id,
      status: "verified",
      isAvailable: true,
      licenseNumber: "RN-LOC-2",
      specialization: "General",
    });

    const first = await updateMyNurseLocation({
      actorUserId: nurseUser!.id,
      lat: 42.6629,
      lng: 21.1655,
    });

    const second = await updateMyNurseLocation({
      actorUserId: nurseUser!.id,
      lat: 40.0001,
      lng: 20.0001,
    });

    expect(first.throttled).toBe(false);
    expect(second.throttled).toBe(true);

    const [stored] = await db
      .select()
      .from(nurseLocations)
      .where(eq(nurseLocations.nurseUserId, nurseUser!.id));

    expect(Number(stored!.lat)).toBeCloseTo(42.6629, 6);
    expect(Number(stored!.lng)).toBeCloseTo(21.1655, 6);
    expect(new Date(second.lastUpdated).toISOString()).toBe(new Date(first.lastUpdated).toISOString());
  });

  it("forbids non-nurse users", async () => {
    const [patientUser] = await db
      .insert(users)
      .values({ email: "location-patient@test.local", role: "patient" })
      .returning();

    await expect(
      updateMyNurseLocation({
        actorUserId: patientUser!.id,
        lat: 42.6629,
        lng: 21.1655,
      }),
    ).rejects.toBeInstanceOf(NurseLocationForbiddenError);
  });
});
