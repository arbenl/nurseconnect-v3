import { db, schema, sql } from "@nurseconnect/database";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getVisitNotificationsForActor } from "./visit-notifications";

const { requestEvents, serviceRequests, users } = schema;

describe.sequential("visit notifications", () => {
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

  it("returns notifications only for the requested actor", async () => {
    const [patientOne] = await db
      .insert(users)
      .values({ email: "visit-notif-patient-one@test.local", role: "patient" })
      .returning();
    const [patientTwo] = await db
      .insert(users)
      .values({ email: "visit-notif-patient-two@test.local", role: "patient" })
      .returning();
    const [nurseOne] = await db
      .insert(users)
      .values({ email: "visit-notif-nurse-one@test.local", role: "nurse" })
      .returning();
    const [nurseTwo] = await db
      .insert(users)
      .values({ email: "visit-notif-nurse-two@test.local", role: "nurse" })
      .returning();

    const [requestOne, requestTwo] = await db
      .insert(serviceRequests)
      .values([
        {
          patientUserId: patientOne!.id,
          assignedNurseUserId: nurseOne!.id,
          status: "assigned",
          address: "Notification One",
          lat: "42.662900",
          lng: "21.165500",
        },
        {
          patientUserId: patientTwo!.id,
          assignedNurseUserId: nurseTwo!.id,
          status: "assigned",
          address: "Notification Two",
          lat: "42.663000",
          lng: "21.166000",
        },
      ])
      .returning();

    await db.insert(requestEvents).values([
      {
        requestId: requestOne!.id,
        type: "request_created",
        actorUserId: patientOne!.id,
        fromStatus: null,
        toStatus: "open",
        meta: null,
      },
      {
        requestId: requestOne!.id,
        type: "request_assigned",
        actorUserId: null,
        fromStatus: "open",
        toStatus: "assigned",
        meta: { nurseUserId: nurseOne!.id },
      },
      {
        requestId: requestTwo!.id,
        type: "request_created",
        actorUserId: patientTwo!.id,
        fromStatus: null,
        toStatus: "open",
        meta: null,
      },
      {
        requestId: requestTwo!.id,
        type: "request_assigned",
        actorUserId: null,
        fromStatus: "open",
        toStatus: "assigned",
        meta: { nurseUserId: nurseTwo!.id },
      },
    ]);

    const patientOneNotifications = await getVisitNotificationsForActor(db, {
      actorUserId: patientOne!.id,
      actorRole: "patient",
    });
    expect(patientOneNotifications.notifications).toHaveLength(2);
    expect(
      patientOneNotifications.notifications.every((event) => event.requestId === requestOne!.id),
    ).toBe(true);

    const nurseOneNotifications = await getVisitNotificationsForActor(db, {
      actorUserId: nurseOne!.id,
      actorRole: "nurse",
    });
    expect(nurseOneNotifications.notifications).toHaveLength(2);
    expect(
      nurseOneNotifications.notifications.every((event) => event.requestId === requestOne!.id),
    ).toBe(true);
  });

  it("returns all notifications for admins", async () => {
    const [admin] = await db
      .insert(users)
      .values({ email: "visit-notif-admin@test.local", role: "admin" })
      .returning();
    const [patient] = await db
      .insert(users)
      .values({ email: "visit-notif-admin-patient@test.local", role: "patient" })
      .returning();

    const [request] = await db
      .insert(serviceRequests)
      .values({
        patientUserId: patient!.id,
        status: "open",
        address: "Admin Notification",
        lat: "42.662900",
        lng: "21.165500",
      })
      .returning();

    await db.insert(requestEvents).values([
      {
        requestId: request!.id,
        type: "request_created",
        actorUserId: patient!.id,
        fromStatus: null,
        toStatus: "open",
        meta: null,
      },
      {
        requestId: request!.id,
        type: "request_canceled",
        actorUserId: patient!.id,
        fromStatus: "open",
        toStatus: "canceled",
        meta: null,
      },
    ]);

    const notifications = await getVisitNotificationsForActor(db, {
      actorUserId: admin!.id,
      actorRole: "admin",
    });

    expect(notifications.notifications).toHaveLength(2);
  });

  it("supports since filters, limit caps, and notification cursors", async () => {
    const [patient] = await db
      .insert(users)
      .values({ email: "visit-notif-limit@test.local", role: "patient" })
      .returning();

    const requests = await db
      .insert(serviceRequests)
      .values([
        {
          patientUserId: patient!.id,
          status: "completed",
          address: "Limit One",
          lat: "42.662900",
          lng: "21.165500",
        },
        {
          patientUserId: patient!.id,
          status: "completed",
          address: "Limit Two",
          lat: "42.662900",
          lng: "21.165500",
        },
        {
          patientUserId: patient!.id,
          status: "completed",
          address: "Limit Three",
          lat: "42.662900",
          lng: "21.165500",
        },
      ])
      .returning();

    await db.insert(requestEvents).values([
      {
        requestId: requests[0]!.id,
        type: "request_completed",
        actorUserId: patient!.id,
        fromStatus: "enroute",
        toStatus: "completed",
        meta: null,
        createdAt: new Date("2026-01-03T10:00:00.000Z"),
      },
      {
        requestId: requests[1]!.id,
        type: "request_completed",
        actorUserId: patient!.id,
        fromStatus: "enroute",
        toStatus: "completed",
        meta: null,
        createdAt: new Date("2026-01-02T10:00:00.000Z"),
      },
      {
        requestId: requests[2]!.id,
        type: "request_completed",
        actorUserId: patient!.id,
        fromStatus: "enroute",
        toStatus: "completed",
        meta: null,
        createdAt: new Date("2026-01-01T10:00:00.000Z"),
      },
    ]);

    const firstPage = await getVisitNotificationsForActor(db, {
      actorUserId: patient!.id,
      actorRole: "patient",
      limit: 2,
    });

    expect(firstPage.notifications).toHaveLength(2);
    expect(firstPage.notifications.map((event) => event.requestId)).toEqual([
      requests[0]!.id,
      requests[1]!.id,
    ]);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await getVisitNotificationsForActor(db, {
      actorUserId: patient!.id,
      actorRole: "patient",
      limit: 2,
      cursor: firstPage.nextCursor,
    });

    expect(secondPage.notifications.map((event) => event.requestId)).toEqual([requests[2]!.id]);

    const futureNotifications = await getVisitNotificationsForActor(db, {
      actorUserId: patient!.id,
      actorRole: "patient",
      sinceIso: new Date("2026-01-04T10:00:00.000Z").toISOString(),
    });

    expect(futureNotifications.notifications).toHaveLength(0);
  });
});
