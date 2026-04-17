import {
  GetPatientVisitsResponseSchema,
  type PatientVisitSummary,
} from "@nurseconnect/contracts";
import { db, eq, schema, sql } from "@nurseconnect/database";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getPatientVisitProjection } from "./patient-visit-projections";

const { serviceRequests, users } = schema;

function sortIds(items: PatientVisitSummary[]) {
  return items.map((item) => item.id);
}

describe.sequential("patient visit projections", () => {
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

  it("returns the current active visit separately from history", async () => {
    const [patient] = await db
      .insert(users)
      .values({ email: "patient-visit-projection@test.local", role: "patient" })
      .returning();

    const [olderCompleted, activeVisit, olderCanceled] = await db
      .insert(serviceRequests)
      .values([
        {
          patientUserId: patient!.id,
          status: "completed",
          address: "Older Completed",
          lat: "42.1",
          lng: "21.1",
          createdAt: new Date("2026-01-01T08:00:00.000Z"),
          updatedAt: new Date("2026-01-01T08:00:00.000Z"),
          completedAt: new Date("2026-01-01T09:00:00.000Z"),
        },
        {
          patientUserId: patient!.id,
          status: "assigned",
          address: "Current Active",
          lat: "42.2",
          lng: "21.2",
          assignedNurseUserId: null,
          createdAt: new Date("2026-01-02T08:00:00.000Z"),
          updatedAt: new Date("2026-01-02T08:00:00.000Z"),
        },
        {
          patientUserId: patient!.id,
          status: "canceled",
          address: "Older Canceled",
          lat: "42.3",
          lng: "21.3",
          createdAt: new Date("2026-01-01T10:00:00.000Z"),
          updatedAt: new Date("2026-01-01T10:00:00.000Z"),
          canceledAt: new Date("2026-01-01T11:00:00.000Z"),
        },
      ])
      .returning();

    const projection = await getPatientVisitProjection(db, {
      actorUserId: patient!.id,
      historyLimit: 10,
    });

    expect(projection.activeVisit?.id).toBe(activeVisit!.id);
    expect(sortIds(projection.recentVisits)).toEqual([
      olderCanceled!.id,
      olderCompleted!.id,
    ]);
    expect(() =>
      GetPatientVisitsResponseSchema.parse([
        projection.activeVisit,
        ...projection.recentVisits,
      ].filter((visit): visit is PatientVisitSummary => visit !== null)),
    ).not.toThrow();
  });

  it("returns older history items after the cursor", async () => {
    const [patient] = await db
      .insert(users)
      .values({ email: "patient-visit-cursor@test.local", role: "patient" })
      .returning();

    const requests = await db
      .insert(serviceRequests)
      .values([
        {
          patientUserId: patient!.id,
          status: "completed",
          address: "History 1",
          lat: "42.1",
          lng: "21.1",
          createdAt: new Date("2026-01-03T08:00:00.000Z"),
          updatedAt: new Date("2026-01-03T08:00:00.000Z"),
          completedAt: new Date("2026-01-03T09:00:00.000Z"),
        },
        {
          patientUserId: patient!.id,
          status: "canceled",
          address: "History 2",
          lat: "42.1",
          lng: "21.1",
          createdAt: new Date("2026-01-02T08:00:00.000Z"),
          updatedAt: new Date("2026-01-02T08:00:00.000Z"),
          canceledAt: new Date("2026-01-02T09:00:00.000Z"),
        },
        {
          patientUserId: patient!.id,
          status: "completed",
          address: "History 3",
          lat: "42.1",
          lng: "21.1",
          createdAt: new Date("2026-01-01T08:00:00.000Z"),
          updatedAt: new Date("2026-01-01T08:00:00.000Z"),
          completedAt: new Date("2026-01-01T09:00:00.000Z"),
        },
      ])
      .returning();

    const firstPage = await getPatientVisitProjection(db, {
      actorUserId: patient!.id,
      historyLimit: 2,
    });

    expect(sortIds(firstPage.recentVisits)).toEqual([
      requests[0]!.id,
      requests[1]!.id,
    ]);
    expect(firstPage.nextHistoryCursor).not.toBeNull();

    const secondPage = await getPatientVisitProjection(db, {
      actorUserId: patient!.id,
      historyLimit: 2,
      historyCursor: firstPage.nextHistoryCursor,
    });

    expect(sortIds(secondPage.recentVisits)).toEqual([requests[2]!.id]);
  });
});
