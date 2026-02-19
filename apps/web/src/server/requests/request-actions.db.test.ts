import { db, eq, schema, sql } from "@nurseconnect/database";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  RequestConflictError,
  RequestForbiddenError,
  applyRequestAction,
} from "./request-actions";

const { users, nurses, serviceRequests } = schema;

describe.sequential("applyRequestAction", () => {
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

  it("allows assigned nurse to accept and forbids other nurses", async () => {
    const [patient] = await db
      .insert(users)
      .values({ email: "patient-accept@test.local", role: "patient" })
      .returning();

    const [nurseA] = await db
      .insert(users)
      .values({ email: "nurse-a-accept@test.local", role: "nurse" })
      .returning();

    const [nurseB] = await db
      .insert(users)
      .values({ email: "nurse-b-accept@test.local", role: "nurse" })
      .returning();

    await db.insert(nurses).values([
      {
        userId: nurseA!.id,
        status: "verified",
        isAvailable: true,
        licenseNumber: "RN-A",
        specialization: "General",
      },
      {
        userId: nurseB!.id,
        status: "verified",
        isAvailable: true,
        licenseNumber: "RN-B",
        specialization: "General",
      },
    ]);

    const [request] = await db
      .insert(serviceRequests)
      .values({
        patientUserId: patient!.id,
        assignedNurseUserId: nurseA!.id,
        status: "assigned",
        address: "Test Address",
        lat: "42.662900",
        lng: "21.165500",
      })
      .returning();

    const accepted = await applyRequestAction({
      requestId: request!.id,
      actorUserId: nurseA!.id,
      action: "accept",
    });

    expect(accepted.status).toBe("accepted");
    expect(accepted.acceptedAt).toBeTruthy();

    await expect(
      applyRequestAction({
        requestId: request!.id,
        actorUserId: nurseB!.id,
        action: "accept",
      })
    ).rejects.toBeInstanceOf(RequestForbiddenError);
  });

  it("handles concurrent accepts with a stable final state", async () => {
    const [patient] = await db
      .insert(users)
      .values({ email: "patient-race@test.local", role: "patient" })
      .returning();

    const [nurse] = await db
      .insert(users)
      .values({ email: "nurse-race@test.local", role: "nurse" })
      .returning();

    await db.insert(nurses).values({
      userId: nurse!.id,
      status: "verified",
      isAvailable: true,
      licenseNumber: "RN-RACE",
      specialization: "General",
    });

    const [request] = await db
      .insert(serviceRequests)
      .values({
        patientUserId: patient!.id,
        assignedNurseUserId: nurse!.id,
        status: "assigned",
        address: "Race Address",
        lat: "42.662900",
        lng: "21.165500",
      })
      .returning();

    const results = await Promise.allSettled([
      applyRequestAction({
        requestId: request!.id,
        actorUserId: nurse!.id,
        action: "accept",
      }),
      applyRequestAction({
        requestId: request!.id,
        actorUserId: nurse!.id,
        action: "accept",
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(RequestConflictError);

    const [stored] = await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.id, request!.id));

    expect(stored?.status).toBe("accepted");
    expect(stored?.acceptedAt).toBeTruthy();
  });
});
