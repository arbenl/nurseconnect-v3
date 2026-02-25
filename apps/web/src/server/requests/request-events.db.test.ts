import { asc, db, eq, schema, sql } from "@nurseconnect/database";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createAndAssignRequest } from "./allocate-request";
import { RequestConflictError, applyRequestAction } from "./request-actions";
import { getNotificationsForActor, getRequestEventsForUser, RequestEventForbiddenError } from "./request-events";

const { users, nurses, nurseLocations, requestEvents, serviceRequests } = schema;

const requestActionTypes = {
  request_created: "request_created",
  request_assigned: "request_assigned",
  request_accepted: "request_accepted",
  request_rejected: "request_rejected",
  request_enroute: "request_enroute",
  request_completed: "request_completed",
  request_canceled: "request_canceled",
} as const;

describe.sequential("request events", () => {
  beforeAll(async () => {
    await db.execute(sql`SELECT 1`);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE service_request_events RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE service_requests RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nurse_locations RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nurses RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  });

  it("creates a request_created event for each request", async () => {
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

    const events = await getRequestEventsForUser({
      requestId: request.id,
      actorUserId: patient!.id,
      actorRole: "patient",
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      requestId: request.id,
      type: requestActionTypes.request_created,
      actorUserId: patient!.id,
      fromStatus: null,
      toStatus: "open",
    });
  });

  it("adds request_assigned when allocation succeeds", async () => {
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
    });

    const request = await createAndAssignRequest({
      patientUserId: patient!.id,
      address: "Assigned Road",
      lat: 10,
      lng: 10,
    });

    const events = await getRequestEventsForUser({
      requestId: request.id,
      actorUserId: patient!.id,
      actorRole: "patient",
    });

    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      requestId: request.id,
      type: requestActionTypes.request_assigned,
      actorUserId: null,
      fromStatus: "open",
      toStatus: "assigned",
      meta: { nurseUserId: nurseUser!.id },
    });
  });

  it("returns notifications only for the requested actor", async () => {
    const [patientOne] = await db
      .insert(users)
      .values({ email: "event-notif-patient-one@test.local", role: "patient" })
      .returning();
    const [patientTwo] = await db
      .insert(users)
      .values({ email: "event-notif-patient-two@test.local", role: "patient" })
      .returning();

    const [nurseOneUser] = await db
      .insert(users)
      .values({ email: "event-notif-nurse-one@test.local", role: "nurse" })
      .returning();

    const [nurseTwoUser] = await db
      .insert(users)
      .values({ email: "event-notif-nurse-two@test.local", role: "nurse" })
      .returning();

    await db.insert(nurses).values([
      {
        userId: nurseOneUser!.id,
        status: "verified",
        licenseNumber: "RN-NOTIF-ONE",
        specialization: "General",
        isAvailable: true,
      },
      {
        userId: nurseTwoUser!.id,
        status: "verified",
        licenseNumber: "RN-NOTIF-TWO",
        specialization: "General",
        isAvailable: true,
      },
    ]);

    await db.insert(nurseLocations).values([
      {
        nurseUserId: nurseOneUser!.id,
        lat: "10.000001",
        lng: "10.000001",
      },
      {
        nurseUserId: nurseTwoUser!.id,
        lat: "40.000001",
        lng: "40.000001",
      },
    ]);

    const requestNearNurseOne = await createAndAssignRequest({
      patientUserId: patientOne!.id,
      address: "Nurse One St",
      lat: 10,
      lng: 10,
    });
    const requestNearNurseTwo = await createAndAssignRequest({
      patientUserId: patientTwo!.id,
      address: "Nurse Two St",
      lat: 40,
      lng: 40,
    });

    const patientOneNotifications = await getNotificationsForActor({
      actorUserId: patientOne!.id,
      actorRole: "patient",
    });
    expect(patientOneNotifications).toHaveLength(2);
    expect(
      patientOneNotifications.every((entry) => entry.requestId === requestNearNurseOne.id)
    ).toBe(true);

    const nurseOneNotifications = await getNotificationsForActor({
      actorUserId: nurseOneUser!.id,
      actorRole: "nurse",
    });
    expect(nurseOneNotifications).toHaveLength(2);
    expect(
      nurseOneNotifications.every((entry) => entry.requestId === requestNearNurseOne.id)
    ).toBe(true);

    const nurseTwoNotifications = await getNotificationsForActor({
      actorUserId: nurseTwoUser!.id,
      actorRole: "nurse",
    });
    expect(nurseTwoNotifications).toHaveLength(2);
    expect(
      nurseTwoNotifications.every((entry) => entry.requestId === requestNearNurseTwo.id)
    ).toBe(true);
  });

  it("supports since filters and limit caps", async () => {
    const [patient] = await db
      .insert(users)
      .values({ email: "event-notif-limit@test.local", role: "patient" })
      .returning();

    const [nurseUser] = await db
      .insert(users)
      .values({ email: "event-notif-limit-nurse@test.local", role: "nurse" })
      .returning();

    await db.insert(nurses).values({
      userId: nurseUser!.id,
      status: "verified",
      licenseNumber: "RN-NOTIF-LIM",
      specialization: "General",
      isAvailable: true,
    });

    await db.insert(nurseLocations).values({
      nurseUserId: nurseUser!.id,
      lat: "20.000001",
      lng: "20.000001",
    });

    for (let i = 0; i < 3; i += 1) {
      await createAndAssignRequest({
        patientUserId: patient!.id,
        address: `Notification Street ${i}`,
        lat: 20,
        lng: 20,
      });
    }

    const cappedLimitNotifications = await getNotificationsForActor({
      actorUserId: patient!.id,
      actorRole: "patient",
      limit: 2,
    });
    expect(cappedLimitNotifications).toHaveLength(2);
    expect(cappedLimitNotifications[0]).toBeDefined();
    expect(cappedLimitNotifications[0]!.type).toBe(requestActionTypes.request_assigned);

    const futureSince = new Date(Date.now() + 60_000).toISOString();
    const futureNotifications = await getNotificationsForActor({
      actorUserId: patient!.id,
      actorRole: "patient",
      sinceIso: futureSince,
    });
    expect(futureNotifications).toHaveLength(0);
  });

  it("returns all events for admins regardless of actor", async () => {
    const [admin] = await db
      .insert(users)
      .values({ email: "event-notif-admin@test.local", role: "admin" })
      .returning();

    const [patientOne] = await db
      .insert(users)
      .values({ email: "event-notif-admin-patient-one@test.local", role: "patient" })
      .returning();
    const [nurseOne] = await db
      .insert(users)
      .values({ email: "event-notif-admin-nurse@test.local", role: "nurse" })
      .returning();

    await db.insert(nurses).values({
      userId: nurseOne!.id,
      status: "verified",
      licenseNumber: "RN-NOTIF-ADMIN",
      specialization: "General",
      isAvailable: true,
    });

    await db.insert(nurseLocations).values({
      nurseUserId: nurseOne!.id,
      lat: "30.000001",
      lng: "30.000001",
    });

    await createAndAssignRequest({
      patientUserId: patientOne!.id,
      address: "Admin View Road",
      lat: 30,
      lng: 30,
    });

    const adminNotifications = await getNotificationsForActor({
      actorUserId: admin!.id,
      actorRole: "admin",
    });
    expect(adminNotifications).toHaveLength(2);
  });

  it("writes timeline events for accepted requests", async () => {
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

  it("blocks unauthorized users from reading events", async () => {
    const [patient] = await db
      .insert(users)
      .values({ email: "event-owner@test.local", role: "patient" })
      .returning();

    const [outsider] = await db
      .insert(users)
      .values({ email: "event-outside@test.local", role: "patient" })
      .returning();

    const request = await db
      .insert(serviceRequests)
      .values({
        patientUserId: patient!.id,
        address: "Private road",
        lat: "10.000000",
        lng: "10.000000",
        status: "open",
      })
      .returning();

    await expect(
      getRequestEventsForUser({
        requestId: request[0]!.id,
        actorUserId: outsider!.id,
        actorRole: "patient",
      })
    ).rejects.toBeInstanceOf(RequestEventForbiddenError);
  });
});
