import { db, eq, schema, sql } from "@nurseconnect/database";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { VisitForbiddenError, VisitNotFoundError } from "./errors";
import { getVisitTimelineForActor } from "./visit-timeline";

const { requestEvents, serviceRequests, users } = schema;

describe.sequential("visit timeline", () => {
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

  it("returns an ordered timeline for actors who can access the request", async () => {
    const [patient] = await db
      .insert(users)
      .values({ email: "visit-timeline-patient@test.local", role: "patient" })
      .returning();
    const [nurseUser] = await db
      .insert(users)
      .values({ email: "visit-timeline-nurse@test.local", role: "nurse" })
      .returning();

    const [request] = await db
      .insert(serviceRequests)
      .values({
        patientUserId: patient!.id,
        assignedNurseUserId: nurseUser!.id,
        status: "accepted",
        address: "Timeline Road",
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
        createdAt: new Date("2026-01-01T08:00:00.000Z"),
      },
      {
        requestId: request!.id,
        type: "request_assigned",
        actorUserId: null,
        fromStatus: "open",
        toStatus: "assigned",
        meta: { nurseUserId: nurseUser!.id },
        createdAt: new Date("2026-01-01T08:05:00.000Z"),
      },
      {
        requestId: request!.id,
        type: "request_accepted",
        actorUserId: nurseUser!.id,
        fromStatus: "assigned",
        toStatus: "accepted",
        meta: null,
        createdAt: new Date("2026-01-01T08:10:00.000Z"),
      },
    ]);

    const timeline = await getVisitTimelineForActor(db, {
      requestId: request!.id,
      actorUserId: patient!.id,
      actorRole: "patient",
    });

    expect(timeline.map((event) => event.type)).toEqual([
      "request_created",
      "request_assigned",
      "request_accepted",
    ]);
    expect(timeline[1]?.meta).toEqual({ nurseUserId: nurseUser!.id });
  });

  it("blocks unrelated actors from reading the timeline", async () => {
    const [patient] = await db
      .insert(users)
      .values({ email: "visit-timeline-owner@test.local", role: "patient" })
      .returning();
    const [outsider] = await db
      .insert(users)
      .values({ email: "visit-timeline-outsider@test.local", role: "patient" })
      .returning();

    const [request] = await db
      .insert(serviceRequests)
      .values({
        patientUserId: patient!.id,
        status: "open",
        address: "Private Timeline Road",
        lat: "42.662900",
        lng: "21.165500",
      })
      .returning();

    await expect(
      getVisitTimelineForActor(db, {
        requestId: request!.id,
        actorUserId: outsider!.id,
        actorRole: "patient",
      }),
    ).rejects.toBeInstanceOf(VisitForbiddenError);
  });

  it("throws when the request does not exist", async () => {
    const [admin] = await db
      .insert(users)
      .values({ email: "visit-timeline-admin@test.local", role: "admin" })
      .returning();

    await expect(
      getVisitTimelineForActor(db, {
        requestId: "11111111-1111-1111-1111-111111111111",
        actorUserId: admin!.id,
        actorRole: "admin",
      }),
    ).rejects.toBeInstanceOf(VisitNotFoundError);
  });
});
