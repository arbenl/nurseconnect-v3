import { count, db, eq, schema, sql } from "@nurseconnect/database";
import {
  NurseCredentialValidationError,
  rejectNurseCredential,
  submitNurseApplication,
  suspendNurseCredential,
  verifyNurseCredential,
} from "@nurseconnect/domain-nurse";
import { beforeEach, describe, expect, it } from "vitest";

const { adminAuditLogs, nurses, users } = schema;

async function countAuditActions(action: string, targetEntityId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(adminAuditLogs)
    .where(eq(adminAuditLogs.action, action));

  return Number(row?.value ?? 0);
}

describe.sequential("nurse credential lifecycle", () => {
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE admin_audit_logs RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nurse_locations RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nurses RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  });

  it("verifies a submitted nurse, promotes role, and records audit", async () => {
    const [adminUser] = await db
      .insert(users)
      .values({ email: "verify-admin@test.local", role: "admin" })
      .returning();

    const [applicantUser] = await db
      .insert(users)
      .values({ email: "verify-applicant@test.local", role: "patient" })
      .returning();

    const submitted = await submitNurseApplication({
      userId: applicantUser!.id,
      licenseNumber: "RN-VERIFY-001",
      licenseJurisdiction: "CA",
      specialization: "General",
    });

    const verified = await verifyNurseCredential({
      actorUserId: adminUser!.id,
      nurseId: submitted.id,
      licenseValidUntil: "2027-12-31T00:00:00.000Z",
      licenseJurisdiction: "CA",
    });

    const [updatedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, applicantUser!.id));

    expect(verified?.status).toBe("verified");
    expect(updatedUser?.role).toBe("nurse");
    expect(await countAuditActions("nurse.credential.verified", submitted.id)).toBe(1);
  });

  it("rejects expired verification dates", async () => {
    const [adminUser] = await db
      .insert(users)
      .values({ email: "expired-admin@test.local", role: "admin" })
      .returning();

    const [applicantUser] = await db
      .insert(users)
      .values({ email: "expired-applicant@test.local", role: "patient" })
      .returning();

    const submitted = await submitNurseApplication({
      userId: applicantUser!.id,
      licenseNumber: "RN-EXPIRED-001",
      licenseJurisdiction: "CA",
      specialization: "General",
    });

    await expect(
      verifyNurseCredential({
        actorUserId: adminUser!.id,
        nurseId: submitted.id,
        licenseValidUntil: "2020-01-01T00:00:00.000Z",
        licenseJurisdiction: "CA",
      }),
    ).rejects.toBeInstanceOf(NurseCredentialValidationError);
  });

  it("reject and suspend force isAvailable false", async () => {
    const [adminUser] = await db
      .insert(users)
      .values({ email: "reject-admin@test.local", role: "admin" })
      .returning();

    const [applicantUser] = await db
      .insert(users)
      .values({ email: "reject-applicant@test.local", role: "patient" })
      .returning();

    const rejectedSeed = await submitNurseApplication({
      userId: applicantUser!.id,
      licenseNumber: "RN-REJECT-001",
      licenseJurisdiction: "CA",
      specialization: "General",
    });

    const rejected = await rejectNurseCredential({
      actorUserId: adminUser!.id,
      nurseId: rejectedSeed.id,
      reason: "Incomplete credentials",
    });

    expect(rejected?.status).toBe("rejected");
    expect(rejected?.isAvailable).toBe(false);

    const [verifiedUser] = await db
      .insert(users)
      .values({ email: "suspend-applicant@test.local", role: "nurse" })
      .returning();

    const verifiedSeed = await submitNurseApplication({
      userId: verifiedUser!.id,
      licenseNumber: "RN-SUSPEND-001",
      licenseJurisdiction: "CA",
      specialization: "General",
    });

    await verifyNurseCredential({
      actorUserId: adminUser!.id,
      nurseId: verifiedSeed.id,
      licenseValidUntil: "2027-12-31T00:00:00.000Z",
      licenseJurisdiction: "CA",
    });

    await db
      .update(nurses)
      .set({ isAvailable: true })
      .where(eq(nurses.id, verifiedSeed.id));

    const suspended = await suspendNurseCredential({
      actorUserId: adminUser!.id,
      nurseId: verifiedSeed.id,
      reason: "Compliance hold",
    });

    expect(suspended?.status).toBe("suspended");
    expect(suspended?.isAvailable).toBe(false);
  });

  it("submits a nurse application idempotently", async () => {
    const [applicantUser] = await db
      .insert(users)
      .values({ email: "idempotent-applicant@test.local", role: "patient" })
      .returning();

    await submitNurseApplication({
      userId: applicantUser!.id,
      licenseNumber: "RN-IDEMP-001",
      licenseJurisdiction: "CA",
      specialization: "General",
    });

    const second = await submitNurseApplication({
      userId: applicantUser!.id,
      licenseNumber: "RN-IDEMP-002",
      licenseJurisdiction: "NY",
      specialization: "ICU",
    });

    const rows = await db
      .select()
      .from(nurses)
      .where(eq(nurses.userId, applicantUser!.id));

    expect(rows).toHaveLength(1);
    expect(second.status).toBe("submitted");
    expect(rows[0]?.licenseNumber).toBe("RN-IDEMP-002");
    expect(rows[0]?.licenseJurisdiction).toBe("NY");
    expect(rows[0]?.specialization).toBe("ICU");
  });
});
