import { asc, db, eq, schema, sql } from "@nurseconnect/database";
import { bootstrapDefaultOrganizationMemberships, DEFAULT_ORGANIZATION_ID } from "@nurseconnect/domain-identity";
import { RequestConflictError } from "@nurseconnect/domain-request";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createAndAssignRequest } from "./allocate-request";
import { applyRequestAction } from "./request-actions";

const { users, nurses, nurseLocations, requestEvents, serviceAreas } = schema;

const requestActionTypes = {
  request_created: "request_created",
  request_assigned: "request_assigned",
  request_accepted: "request_accepted",
} as const;

async function seedServiceArea() {
  const [area] = await db
    .insert(serviceAreas)
    .values({
      label: "Request Events Test Area",
      centerLat: "10.000000",
      centerLng: "10.000000",
      radiusMeters: 150000,
      status: "active",
    })
    .returning();

  return area!;
}

describe.sequential("request events", () => {
  beforeAll(async () => {
    await db.execute(sql`SELECT 1`);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE service_request_events RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE service_requests RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nurse_locations RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nurses RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE service_areas RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
    await bootstrapDefaultOrganizationMemberships();
  });

  it("creates a request_created event for each request", async () => {
    await seedServiceArea();

    const [patient] = await db
      .insert(users)
      .values({ email: "event-created@test.local", role: "patient" })
      .returning();

    const request = await createAndAssignRequest({
      patientUserId: patient!.id,
      address: "Create Event Road",
      lat: 10,
      lng: 10,
    });

    const events = await db
      .select()
      .from(requestEvents)
      .where(eq(requestEvents.requestId, request.id))
      .orderBy(asc(requestEvents.id));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      requestId: request.id,
      organizationId: DEFAULT_ORGANIZATION_ID,
      type: requestActionTypes.request_created,
      actorUserId: patient!.id,
      fromStatus: null,
      toStatus: "open",
    });
  });

  it("adds request_assigned when allocation succeeds", async () => {
    const serviceArea = await seedServiceArea();

    const [patient] = await db
      .insert(users)
      .values({ email: "event-assigned@test.local", role: "patient" })
      .returning();

    const [nurseUser] = await db
      .insert(users)
      .values({ email: "event-nurse@test.local", role: "nurse" })
      .returning();

    await db.insert(nurses).values({
      userId: nurseUser!.id,
      status: "verified",
      licenseNumber: "RN-ASSIGN-E",
      specialization: "General",
      isAvailable: true,
    });

    await db.insert(nurseLocations).values({
      nurseUserId: nurseUser!.id,
      lat: "10.000001",
      lng: "10.000001",
      serviceAreaId: serviceArea.id,
    });

    const request = await createAndAssignRequest({
      patientUserId: patient!.id,
      address: "Assigned Road",
      lat: 10,
      lng: 10,
    });

    const events = await db
      .select()
      .from(requestEvents)
      .where(eq(requestEvents.requestId, request.id))
      .orderBy(asc(requestEvents.id));

    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      requestId: request.id,
      organizationId: DEFAULT_ORGANIZATION_ID,
      type: requestActionTypes.request_assigned,
      actorUserId: null,
      fromStatus: "open",
      toStatus: "assigned",
      meta: { nurseUserId: nurseUser!.id },
    });
  });

  it("writes timeline events for accepted requests", async () => {
    const serviceArea = await seedServiceArea();

    const [patient] = await db
      .insert(users)
      .values({ email: "event-accept-patient@test.local", role: "patient" })
      .returning();

    const [nurseUser] = await db
      .insert(users)
      .values({ email: "event-accept-nurse@test.local", role: "nurse" })
      .returning();

    await db.insert(nurses).values({
      userId: nurseUser!.id,
      status: "verified",
      licenseNumber: "RN-ACCEPT-E",
      specialization: "General",
      isAvailable: true,
    });

    await db.insert(nurseLocations).values({
      nurseUserId: nurseUser!.id,
      lat: "10.000001",
      lng: "10.000001",
      serviceAreaId: serviceArea.id,
    });

    const request = await createAndAssignRequest({
      patientUserId: patient!.id,
      address: "Accept Road",
      lat: 10,
      lng: 10,
    });

    const accepted = await applyRequestAction({
      requestId: request.id,
      actorUserId: nurseUser!.id,
      action: "accept",
    });

    expect(accepted.status).toBe("accepted");

    const events = await db
      .select()
      .from(requestEvents)
      .where(eq(requestEvents.requestId, request.id))
      .orderBy(asc(requestEvents.id));

    expect(events).toHaveLength(3);
    expect(events.map((event) => event.type)).toEqual([
      requestActionTypes.request_created,
      requestActionTypes.request_assigned,
      requestActionTypes.request_accepted,
    ]);
    expect(events[2]).toMatchObject({
      actorUserId: nurseUser!.id,
      fromStatus: "assigned",
      toStatus: "accepted",
    });
    expect(events[2]!.meta).toBeNull();
    expect(accepted.patientUserId).toBe(patient!.id);
  });

  it("does not append events for failed transitions", async () => {
    const serviceArea = await seedServiceArea();

    const [patient] = await db
      .insert(users)
      .values({ email: "event-conflict-patient@test.local", role: "patient" })
      .returning();

    const [nurseUser] = await db
      .insert(users)
      .values({ email: "event-conflict-nurse@test.local", role: "nurse" })
      .returning();

    await db.insert(nurses).values({
      userId: nurseUser!.id,
      status: "verified",
      licenseNumber: "RN-CONFLICT-E",
      specialization: "General",
      isAvailable: true,
    });

    await db.insert(nurseLocations).values({
      nurseUserId: nurseUser!.id,
      lat: "10.000001",
      lng: "10.000001",
      serviceAreaId: serviceArea.id,
    });

    const request = await createAndAssignRequest({
      patientUserId: patient!.id,
      address: "Conflict Road",
      lat: 10,
      lng: 10,
    });

    await applyRequestAction({
      requestId: request.id,
      actorUserId: nurseUser!.id,
      action: "accept",
    });

    await expect(
      applyRequestAction({
        requestId: request.id,
        actorUserId: nurseUser!.id,
        action: "accept",
      })
    ).rejects.toBeInstanceOf(RequestConflictError);

    const rows = await db
      .select({ type: requestEvents.type })
      .from(requestEvents)
      .where(eq(requestEvents.requestId, request.id));

    expect(rows).toHaveLength(3);
    expect(rows).toEqual([
      { type: requestActionTypes.request_created },
      { type: requestActionTypes.request_assigned },
      { type: requestActionTypes.request_accepted },
    ]);
  });

});
