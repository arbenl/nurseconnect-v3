import { db, schema, sql } from "@nurseconnect/database";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getAdminActiveRequestQueue } from "./active-request-queue";
import { getAdminExceptionQueue } from "./exception-queue";

const { requestEvents, serviceRequests, users } = schema;

describe.sequential("admin exception queue", () => {
  beforeAll(async () => {
    await db.execute(sql`SELECT 1`);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE service_request_events RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE service_requests RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE referral_partners RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  });

  it("separates exception requests from the active queue and exposes latest reason", async () => {
    const [admin, patient] = await db
      .insert(users)
      .values([
        { email: "exception-admin@test.local", role: "admin" },
        { email: "exception-patient@test.local", role: "patient" },
      ])
      .returning();

    const now = new Date("2026-04-20T12:00:00.000Z");
    const createdAt = new Date("2026-04-20T10:30:00.000Z");
    const firstUpdatedAt = new Date("2026-04-20T11:00:00.000Z");
    const latestUpdatedAt = new Date("2026-04-20T11:45:00.000Z");

    const [needsReview] = await db
      .insert(serviceRequests)
      .values({
        patientUserId: patient!.id,
        address: "Exception Queue Street",
        lat: "42.662900",
        lng: "21.165500",
        status: "needs_review",
        needsReviewAt: latestUpdatedAt,
        createdAt,
        updatedAt: latestUpdatedAt,
      })
      .returning();

    await db.insert(requestEvents).values([
      {
        requestId: needsReview!.id,
        type: "request_created",
        actorUserId: patient!.id,
        fromStatus: null,
        toStatus: "open",
        createdAt,
      },
      {
        requestId: needsReview!.id,
        type: "request_needs_review",
        actorUserId: admin!.id,
        fromStatus: "open",
        toStatus: "needs_review",
        meta: { reason: "Insurance callback needed" },
        createdAt: latestUpdatedAt,
      },
    ]);

    const [declined] = await db
      .insert(serviceRequests)
      .values({
        patientUserId: patient!.id,
        address: "Declined Queue Street",
        lat: "42.650000",
        lng: "21.170000",
        status: "declined",
        declinedAt: firstUpdatedAt,
        createdAt,
        updatedAt: firstUpdatedAt,
      })
      .returning();

    await db.insert(requestEvents).values({
      requestId: declined!.id,
      type: "request_declined",
      actorUserId: admin!.id,
      fromStatus: "needs_review",
      toStatus: "declined",
      meta: { reason: "Outside clinical scope" },
      createdAt: firstUpdatedAt,
    });

    const activeQueue = await getAdminActiveRequestQueue(db, { now });
    expect(activeQueue.items).toHaveLength(0);

    const exceptionQueue = await getAdminExceptionQueue(db, { now });
    expect(exceptionQueue.items.map((item) => item.requestId)).toEqual([
      needsReview!.id,
      declined!.id,
    ]);
    expect(exceptionQueue.items[0]).toMatchObject({
      status: "needs_review",
      reason: "Insurance callback needed",
      actorUserId: admin!.id,
      waitMinutes: 90,
      locationHint: "~42.66,21.17",
    });
  });
});
