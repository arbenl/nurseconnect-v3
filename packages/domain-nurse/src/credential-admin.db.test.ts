import { organizationId } from "@nurseconnect/contracts";
import { db, eq, schema, sql } from "@nurseconnect/database";
import { authorizeTenantAction } from "@nurseconnect/platform-authz";
import { beforeEach, describe, expect, it } from "vitest";

import { persistCredentialStatus, rejectNurseCredential } from "./credential-admin";
import { canRejectCredential, canVerifyCredential } from "./credential-evidence";
import { submitNurseApplication } from "./credential-lifecycle";
import { NurseCredentialConflictError } from "./errors";

const { nurses, users } = schema;
const org = organizationId("00000000-0000-4000-8000-000000000001");

const authority = (actorUserId: string, nurseId: string) => ({
  organizationId: org,
  nurseId,
  actorUserId,
  policyDecision: authorizeTenantAction({
    subject: { userId: actorUserId, personaRole: "admin", organizationId: org, membershipRole: "admin", membershipStatus: "active" },
    action: "tenant.write",
    resource: { kind: "organization", organizationId: org },
    context: { tenantId: org },
  }),
});

async function seedSubmittedNurse(email: string, licenseNumber: string) {
  const [user] = await db.insert(users).values({ email, role: "patient" }).returning();
  return submitNurseApplication({
    userId: user!.id,
    licenseNumber,
    licenseJurisdiction: "CA",
    specialization: "General",
  });
}

describe.sequential("credential status persistence contract", () => {
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE admin_audit_logs RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nurse_locations RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nurses RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  });

  it("turns stale credential proof into a conflict before updating", async () => {
    const [admin] = await db.insert(users).values({ email: "stale-admin@test.local", role: "admin" }).returning();
    const submitted = await seedSubmittedNurse("stale-nurse@test.local", "RN-STALE-001");
    const proofContext = authority(admin!.id, submitted.id);
    const staleEvidence = canVerifyCredential("submitted", proofContext);

    await rejectNurseCredential({
      ...proofContext,
      reason: "Initial decision",
    });

    await expect(
      db.transaction((tx) =>
        persistCredentialStatus(proofContext, "submitted", "verify", staleEvidence, {
          licenseValidUntil: new Date("2027-12-31T00:00:00.000Z"),
          licenseJurisdiction: "CA",
          verifiedBy: admin!.id,
          verifiedAt: new Date("2026-01-01T00:00:00.000Z"),
        }, tx),
      ),
    ).rejects.toBeInstanceOf(NurseCredentialConflictError);
  });

  it("rejects proof minted for nurse A before nurse B can be updated", async () => {
    const [admin] = await db.insert(users).values({ email: "wrong-nurse-admin@test.local", role: "admin" }).returning();
    const nurseA = await seedSubmittedNurse("wrong-nurse-a@test.local", "RN-WRONG-A");
    const nurseB = await seedSubmittedNurse("wrong-nurse-b@test.local", "RN-WRONG-B");
    const proofForA = canRejectCredential("submitted", authority(admin!.id, nurseA.id));
    const contextForB = authority(admin!.id, nurseB.id);

    await expect(
      db.transaction((tx) =>
        persistCredentialStatus(contextForB, "submitted", "reject", proofForA, {
          isAvailable: false,
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        }, tx),
      ),
    ).rejects.toThrow("proof does not match");

    const [unchangedB] = await db.select().from(nurses).where(eq(nurses.id, nurseB.id));
    expect(unchangedB?.status).toBe("submitted");
  });
});
