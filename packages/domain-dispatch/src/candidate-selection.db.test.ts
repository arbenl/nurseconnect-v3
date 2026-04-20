import { db, eq, schema, sql } from "@nurseconnect/database";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { selectDispatchCandidate } from "./candidate-selection";

const { nurseLocations, nurses, serviceAreas, users } = schema;

describe.sequential("selectDispatchCandidate service-area scoping", () => {
  beforeAll(async () => {
    await db.execute(sql`SELECT 1`);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE service_request_events RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE admin_audit_logs RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE service_requests RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nurse_locations RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nurses RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE service_areas RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  });

  it("only selects nurses whose latest location matches the request service area", async () => {
    const [requestArea, otherArea] = await db
      .insert(serviceAreas)
      .values([
        {
          label: "Pristina",
          centerLat: "42.662900",
          centerLng: "21.165500",
          radiusMeters: 15000,
          status: "active",
        },
        {
          label: "Tirana",
          centerLat: "41.327500",
          centerLng: "19.818900",
          radiusMeters: 15000,
          status: "active",
        },
      ])
      .returning();

    const [matchingUser, closerOutOfAreaUser] = await db
      .insert(users)
      .values([
        { email: "dispatch-area-match@test.local", role: "nurse" },
        { email: "dispatch-area-other@test.local", role: "nurse" },
      ])
      .returning();

    await db.insert(nurses).values([
      {
        userId: matchingUser!.id,
        status: "verified",
        licenseNumber: "RN-MATCH-001",
        licenseJurisdiction: "XK",
        specialization: "General",
        licenseValidUntil: new Date("2027-01-01T00:00:00.000Z"),
        isAvailable: true,
      },
      {
        userId: closerOutOfAreaUser!.id,
        status: "verified",
        licenseNumber: "RN-OTHER-001",
        licenseJurisdiction: "XK",
        specialization: "General",
        licenseValidUntil: new Date("2027-01-01T00:00:00.000Z"),
        isAvailable: true,
      },
    ]);

    await db.insert(nurseLocations).values([
      {
        nurseUserId: matchingUser!.id,
        lat: "42.663500",
        lng: "21.166200",
        serviceAreaId: requestArea!.id,
      },
      {
        nurseUserId: closerOutOfAreaUser!.id,
        lat: "42.662901",
        lng: "21.165501",
        serviceAreaId: otherArea!.id,
      },
    ]);

    const picked = await db.transaction((tx) =>
      selectDispatchCandidate(tx, { lat: 42.6629, lng: 21.1655 }, requestArea!.id),
    );

    expect(picked?.nurseUserId).toBe(matchingUser!.id);

    const lockedOutOfAreaLocation = await db.query.nurseLocations.findFirst({
      where: eq(nurseLocations.nurseUserId, closerOutOfAreaUser!.id),
    });
    expect(lockedOutOfAreaLocation?.serviceAreaId).toBe(otherArea!.id);
  });
});
