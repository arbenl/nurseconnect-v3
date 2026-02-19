import { db, schema, sql } from "@nurseconnect/database";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { appendRequestEvent } from "@/server/requests/request-events";

import { AdminRequestNotFoundError, getAdminRequestDetail, getAdminRequests, getAdminUsers } from "./admin-reads";

const { nurses, users, serviceRequests } = schema;

describe.sequential("admin read services", () => {
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

  it("paginates users deterministically", async () => {
    await db.insert(users).values([
      {
        email: "u1@test.local",
        role: "patient",
        createdAt: new Date("2026-02-10T10:00:00.000Z"),
        updatedAt: new Date("2026-02-10T10:00:00.000Z"),
      },
      {
        email: "u2@test.local",
        role: "patient",
        createdAt: new Date("2026-02-11T10:00:00.000Z"),
        updatedAt: new Date("2026-02-11T10:00:00.000Z"),
      },
      {
        email: "u3@test.local",
        role: "patient",
        createdAt: new Date("2026-02-12T10:00:00.000Z"),
        updatedAt: new Date("2026-02-12T10:00:00.000Z"),
      },
    ]);

    const first = await getAdminUsers({ limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBeTruthy();

    const second = await getAdminUsers({
      limit: 2,
      cursor: first.nextCursor ?? undefined,
    });
    expect(second.items).toHaveLength(1);
  });

  it("filters requests by status and orders by createdAt desc", async () => {
    const [_admin] = await db
      .insert(users)
      .values({
        email: "admin-requests@test.local",
        role: "admin",
      })
      .returning();

    const [patient] = await db
      .insert(users)
      .values({ email: "patient-requests@test.local", role: "patient" })
      .returning();

    const [nurseUser] = await db
      .insert(users)
      .values({ email: "nurse-requests@test.local", role: "nurse" })
      .returning();

    await db.insert(nurses).values({
      userId: nurseUser!.id,
      status: "verified",
      licenseNumber: "RN-FILTER",
      specialization: "General",
      isAvailable: true,
    });

    await db.insert(serviceRequests).values([
      {
        patientUserId: patient!.id,
        address: "Assigned request",
        lat: "10",
        lng: "10",
        status: "assigned",
        assignedNurseUserId: nurseUser!.id,
        createdAt: new Date("2026-02-11T10:00:00.000Z"),
        updatedAt: new Date("2026-02-11T10:00:00.000Z"),
      },
      {
        patientUserId: patient!.id,
        address: "Open request",
        lat: "11",
        lng: "11",
        status: "open",
        createdAt: new Date("2026-02-12T10:00:00.000Z"),
        updatedAt: new Date("2026-02-12T10:00:00.000Z"),
      },
      {
        patientUserId: patient!.id,
        address: "Completed request",
        lat: "12",
        lng: "12",
        status: "completed",
        createdAt: new Date("2026-02-13T10:00:00.000Z"),
        updatedAt: new Date("2026-02-13T10:00:00.000Z"),
      },
    ]);

    const assigned = await getAdminRequests({ status: "assigned", limit: 10 });
    expect(assigned.items).toHaveLength(1);
    expect(assigned.items[0]).toBeDefined();
    expect(assigned.items[0]!.status).toBe("assigned");

    const all = await getAdminRequests({ limit: 10 });
    expect(all.items[0]?.status).toBe("completed");
    expect(all.items[1]?.status).toBe("open");
    expect(all.items[2]?.status).toBe("assigned");
  });

  it("returns request detail with events for admin readers", async () => {
    const [admin] = await db
      .insert(users)
      .values({ email: "admin-detail@test.local", role: "admin" })
      .returning();

    const [patient] = await db
      .insert(users)
      .values({ email: "patient-detail@test.local", role: "patient" })
      .returning();

    const [request] = await db.insert(serviceRequests).values({
      patientUserId: patient!.id,
      address: "Detail request",
      lat: "42.1",
      lng: "21.1",
      status: "open",
    }).returning();

    await db.transaction(async (tx) => {
      await appendRequestEvent(tx, {
        requestId: request!.id,
        type: "request_created",
        actorUserId: patient!.id,
        fromStatus: null,
        toStatus: "open",
      });
    });

    await expect(
      getAdminRequestDetail({ requestId: request!.id, actorUserId: admin!.id })
    ).resolves.toMatchObject({
      request: {
        id: request!.id,
        status: "open",
      },
      events: [
        expect.objectContaining({
          type: "request_created",
        }),
      ],
    });
  });

  it("throws for unknown request id", async () => {
    await expect(
      getAdminRequestDetail({ requestId: "00000000-0000-0000-0000-000000000000", actorUserId: "00000000-0000-0000-0000-000000000001" }),
    ).rejects.toBeInstanceOf(AdminRequestNotFoundError);
  });
});
