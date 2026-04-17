import { db, eq, schema, sql } from "@nurseconnect/database";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  NurseAvailabilityError,
  NurseCredentialValidationError,
  NurseProfileNotFoundError,
} from "./errors";
import { setMyAvailability, submitOwnNurseApplication } from "./self-service";

const { nurses, users } = schema;

describe.sequential("nurse self-service submission", () => {
  beforeAll(async () => {
    await db.execute(sql`SELECT 1`);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE service_request_events RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE admin_audit_logs RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE service_requests RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nurse_locations RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nurses RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  });

  it("creates a submitted application when no nurse row exists", async () => {
    const [user] = await db
      .insert(users)
      .values({ email: "self-serve-create@test.local", role: "patient" })
      .returning();

    const submitted = await submitOwnNurseApplication({
      userId: user!.id,
      licenseNumber: "RN-CREATE-001",
      licenseJurisdiction: "CA",
      specialization: "ICU",
    });

    expect(submitted).toMatchObject({
      userId: user!.id,
      status: "submitted",
      licenseNumber: "RN-CREATE-001",
      licenseJurisdiction: "CA",
      specialization: "ICU",
      isAvailable: false,
    });
  });

  it("allows resubmission while the application is already submitted", async () => {
    const [user] = await db
      .insert(users)
      .values({ email: "self-serve-resubmit@test.local", role: "patient" })
      .returning();

    await db.insert(nurses).values({
      userId: user!.id,
      status: "submitted",
      licenseNumber: "RN-OLD-001",
      licenseJurisdiction: "CA",
      specialization: "General",
      isAvailable: true,
    });

    const submitted = await submitOwnNurseApplication({
      userId: user!.id,
      licenseNumber: "RN-NEW-001",
      licenseJurisdiction: "NY",
      specialization: "Emergency",
    });

    expect(submitted).toMatchObject({
      userId: user!.id,
      status: "submitted",
      licenseNumber: "RN-NEW-001",
      licenseJurisdiction: "NY",
      specialization: "Emergency",
      isAvailable: false,
    });
  });

  it("rejects resubmission when the nurse is already verified", async () => {
    const [user] = await db
      .insert(users)
      .values({ email: "self-serve-verified@test.local", role: "nurse" })
      .returning();

    await db.insert(nurses).values({
      userId: user!.id,
      status: "verified",
      licenseNumber: "RN-LOCKED-001",
      licenseJurisdiction: "CA",
      specialization: "Telemetry",
      licenseValidUntil: new Date("2027-12-31T00:00:00.000Z"),
      isAvailable: true,
    });

    await expect(
      submitOwnNurseApplication({
        userId: user!.id,
        licenseNumber: "RN-OVERRIDE-001",
        licenseJurisdiction: "NY",
        specialization: "Emergency",
      }),
    ).rejects.toThrow(NurseCredentialValidationError);

    const persisted = await db.query.nurses.findFirst({
      where: eq(nurses.userId, user!.id),
    });

    expect(persisted).toMatchObject({
      userId: user!.id,
      status: "verified",
      licenseNumber: "RN-LOCKED-001",
      licenseJurisdiction: "CA",
      specialization: "Telemetry",
      isAvailable: true,
    });
  });

  it("throws a typed not-found error when no nurse profile exists", async () => {
    const [user] = await db
      .insert(users)
      .values({ email: "availability-missing@test.local", role: "nurse" })
      .returning();

    await expect(
      setMyAvailability({
        actorUserId: user!.id,
        isAvailable: true,
      }),
    ).rejects.toThrow(NurseProfileNotFoundError);
  });

  it("rejects unverified nurses who try to mark themselves available", async () => {
    const [user] = await db
      .insert(users)
      .values({ email: "availability-unverified@test.local", role: "patient" })
      .returning();

    await db.insert(nurses).values({
      userId: user!.id,
      status: "submitted",
      licenseNumber: "RN-UNVERIFIED-001",
      licenseJurisdiction: "CA",
      specialization: "General",
      isAvailable: false,
    });

    await expect(
      setMyAvailability({
        actorUserId: user!.id,
        isAvailable: true,
      }),
    ).rejects.toThrow(NurseAvailabilityError);

    const persisted = await db.query.nurses.findFirst({
      where: eq(nurses.userId, user!.id),
    });

    expect(persisted?.isAvailable).toBe(false);
  });

  it("rejects expired verified nurses who try to mark themselves available", async () => {
    const [user] = await db
      .insert(users)
      .values({ email: "availability-expired@test.local", role: "nurse" })
      .returning();

    await db.insert(nurses).values({
      userId: user!.id,
      status: "verified",
      licenseNumber: "RN-EXPIRED-001",
      licenseJurisdiction: "CA",
      specialization: "General",
      licenseValidUntil: new Date("2020-01-01T00:00:00.000Z"),
      isAvailable: false,
    });

    await expect(
      setMyAvailability({
        actorUserId: user!.id,
        isAvailable: true,
      }),
    ).rejects.toThrow(NurseAvailabilityError);

    const persisted = await db.query.nurses.findFirst({
      where: eq(nurses.userId, user!.id),
    });

    expect(persisted?.isAvailable).toBe(false);
  });

  it("allows verified nurses to toggle availability on and back off", async () => {
    const [user] = await db
      .insert(users)
      .values({ email: "availability-verified@test.local", role: "nurse" })
      .returning();

    await db.insert(nurses).values({
      userId: user!.id,
      status: "verified",
      licenseNumber: "RN-VERIFIED-001",
      licenseJurisdiction: "CA",
      specialization: "ICU",
      licenseValidUntil: new Date("2027-12-31T00:00:00.000Z"),
      isAvailable: false,
    });

    const available = await setMyAvailability({
      actorUserId: user!.id,
      isAvailable: true,
    });

    expect(available).toMatchObject({
      userId: user!.id,
      isAvailable: true,
    });

    const unavailable = await setMyAvailability({
      actorUserId: user!.id,
      isAvailable: false,
    });

    expect(unavailable).toMatchObject({
      userId: user!.id,
      isAvailable: false,
    });
  });
});
