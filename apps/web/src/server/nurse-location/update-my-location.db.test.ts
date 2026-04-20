import { db, eq, schema, sql } from "@nurseconnect/database";
import { NurseLocationForbiddenError, updateMyNurseLocation } from "@nurseconnect/domain-nurse";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const { users, nurses, nurseLocations, serviceAreas } = schema;

async function seedServiceArea() {
  const [area] = await db
    .insert(serviceAreas)
    .values({
      label: "Location Test Area",
      centerLat: "42.662900",
      centerLng: "21.165500",
      radiusMeters: 15000,
      status: "active",
    })
    .returning();

  return area!;
}

describe.sequential("updateMyNurseLocation", () => {
  beforeAll(async () => {
    await db.execute(sql`SELECT 1`);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE service_requests RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nurse_locations RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nurses RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE service_areas RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  });

  it("creates a nurse location with the resolved service area on first update", async () => {
    const serviceArea = await seedServiceArea();
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
      serviceAreaId: serviceArea.id,
    });

    expect(result.ok).toBe(true);
    expect(result.throttled).toBe(false);
    expect(result.serviceAreaId).toBe(serviceArea.id);

    const [stored] = await db
      .select()
      .from(nurseLocations)
      .where(eq(nurseLocations.nurseUserId, nurseUser!.id));

    expect(stored).toBeTruthy();
    expect(Number(stored!.lat)).toBeCloseTo(42.6629, 6);
    expect(Number(stored!.lng)).toBeCloseTo(21.1655, 6);
    expect(stored!.serviceAreaId).toBe(serviceArea.id);
    expect(stored!.lastUpdated).toBeTruthy();
  });

  it("throttles immediate second update and keeps previous coordinates and service area", async () => {
    const serviceArea = await seedServiceArea();
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
      serviceAreaId: serviceArea.id,
    });

    const second = await updateMyNurseLocation({
      actorUserId: nurseUser!.id,
      lat: 40.0001,
      lng: 20.0001,
      serviceAreaId: null,
    });

    expect(first.throttled).toBe(false);
    expect(second.throttled).toBe(true);

    const [stored] = await db
      .select()
      .from(nurseLocations)
      .where(eq(nurseLocations.nurseUserId, nurseUser!.id));

    expect(Number(stored!.lat)).toBeCloseTo(42.6629, 6);
    expect(Number(stored!.lng)).toBeCloseTo(21.1655, 6);
    expect(stored!.serviceAreaId).toBe(serviceArea.id);
    expect(second.serviceAreaId).toBe(serviceArea.id);
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
        serviceAreaId: null,
      }),
    ).rejects.toBeInstanceOf(NurseLocationForbiddenError);
  });
});
