import { NurseVisitFeedResponseSchema } from "@nurseconnect/contracts";
import { db, schema, sql } from "@nurseconnect/database";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getNurseVisitProjection } from "./nurse-visit-projections";

const { serviceRequests, users } = schema;

describe.sequential("nurse visit projections", () => {
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

  it("returns only assigned nurse work and excludes same-user patient requests", async () => {
    const [nurseUser] = await db
      .insert(users)
      .values({ email: "nurse-projection@test.local", role: "nurse" })
      .returning();
    const [patientUser] = await db
      .insert(users)
      .values({ email: "nurse-projection-patient@test.local", role: "patient" })
      .returning();

    const [assignedWork] = await db
      .insert(serviceRequests)
      .values([
        {
          patientUserId: patientUser!.id,
          assignedNurseUserId: nurseUser!.id,
          status: "assigned",
          address: "Assigned Work",
          lat: "42.1",
          lng: "21.1",
          createdAt: new Date("2026-01-02T08:00:00.000Z"),
          updatedAt: new Date("2026-01-02T08:00:00.000Z"),
        },
        {
          patientUserId: nurseUser!.id,
          assignedNurseUserId: null,
          status: "open",
          address: "Same User As Patient",
          lat: "42.2",
          lng: "21.2",
          createdAt: new Date("2026-01-03T08:00:00.000Z"),
          updatedAt: new Date("2026-01-03T08:00:00.000Z"),
        },
      ])
      .returning();

    const projection = await getNurseVisitProjection(db, {
      actorUserId: nurseUser!.id,
      historyLimit: 5,
    });

    expect(projection.activeAssignment?.id).toBe(assignedWork!.id);
    expect(projection.recentAssignments).toHaveLength(0);
  });

  it("returns active assignment separately and limits recent assignments", async () => {
    const [nurseUser] = await db
      .insert(users)
      .values({ email: "nurse-projection-history@test.local", role: "nurse" })
      .returning();
    const [patientUser] = await db
      .insert(users)
      .values({ email: "nurse-projection-history-patient@test.local", role: "patient" })
      .returning();

    const rows = await db
      .insert(serviceRequests)
      .values([
        {
          patientUserId: patientUser!.id,
          assignedNurseUserId: nurseUser!.id,
          status: "assigned",
          address: "Current Assignment",
          lat: "42.0",
          lng: "21.0",
          createdAt: new Date("2026-01-10T08:00:00.000Z"),
          updatedAt: new Date("2026-01-10T08:00:00.000Z"),
        },
        ...Array.from({ length: 6 }, (_, index) => ({
          patientUserId: patientUser!.id,
          assignedNurseUserId: nurseUser!.id,
          status: "completed" as const,
          address: `Recent ${index + 1}`,
          lat: "42.0",
          lng: "21.0",
          createdAt: new Date(`2026-01-0${6 - index}T08:00:00.000Z`),
          updatedAt: new Date(`2026-01-0${6 - index}T08:00:00.000Z`),
          completedAt: new Date(`2026-01-0${6 - index}T09:00:00.000Z`),
        })),
      ])
      .returning();

    const projection = await getNurseVisitProjection(db, {
      actorUserId: nurseUser!.id,
      historyLimit: 5,
    });

    expect(projection.activeAssignment?.id).toBe(rows[0]!.id);
    expect(projection.recentAssignments).toHaveLength(5);
    expect(projection.recentAssignments[0]?.id).toBe(rows[1]!.id);
    expect(projection.recentAssignments[4]?.id).toBe(rows[5]!.id);
    expect(() =>
      NurseVisitFeedResponseSchema.parse({
        activeAssignment: projection.activeAssignment,
        recentAssignments: projection.recentAssignments,
      }),
    ).not.toThrow();
  });

  it("supports an unbounded history adapter when historyLimit is null", async () => {
    const [nurseUser] = await db
      .insert(users)
      .values({ email: "nurse-projection-all@test.local", role: "nurse" })
      .returning();
    const [patientUser] = await db
      .insert(users)
      .values({ email: "nurse-projection-all-patient@test.local", role: "patient" })
      .returning();

    const rows = await db
      .insert(serviceRequests)
      .values([
        {
          patientUserId: patientUser!.id,
          assignedNurseUserId: nurseUser!.id,
          status: "assigned",
          address: "Current Assignment",
          lat: "42.0",
          lng: "21.0",
          createdAt: new Date("2026-01-04T08:00:00.000Z"),
          updatedAt: new Date("2026-01-04T08:00:00.000Z"),
        },
        {
          patientUserId: patientUser!.id,
          assignedNurseUserId: nurseUser!.id,
          status: "completed",
          address: "Recent A",
          lat: "42.0",
          lng: "21.0",
          createdAt: new Date("2026-01-03T08:00:00.000Z"),
          updatedAt: new Date("2026-01-03T08:00:00.000Z"),
          completedAt: new Date("2026-01-03T09:00:00.000Z"),
        },
        {
          patientUserId: patientUser!.id,
          assignedNurseUserId: nurseUser!.id,
          status: "completed",
          address: "Recent B",
          lat: "42.0",
          lng: "21.0",
          createdAt: new Date("2026-01-02T08:00:00.000Z"),
          updatedAt: new Date("2026-01-02T08:00:00.000Z"),
          completedAt: new Date("2026-01-02T09:00:00.000Z"),
        },
      ])
      .returning();

    const projection = await getNurseVisitProjection(db, {
      actorUserId: nurseUser!.id,
      historyLimit: null,
    });

    expect(projection.activeAssignment?.id).toBe(rows[0]!.id);
    expect(projection.recentAssignments.map((row) => row.id)).toEqual([
      rows[1]!.id,
      rows[2]!.id,
    ]);
    expect(projection.nextHistoryCursor).toBeNull();
  });
});
