import { organizationId } from "@nurseconnect/contracts";
import { count, db, schema, sql } from "@nurseconnect/database";
import { DEFAULT_ORGANIZATION_ID } from "@nurseconnect/domain-identity";
import {
  NurseCredentialConflictError,
  rejectNurseCredential,
  submitNurseApplication,
  verifyNurseCredential,
} from "@nurseconnect/domain-nurse";
import { authorizeTenantAction } from "@nurseconnect/platform-authz";
import { beforeEach, describe, expect, it } from "vitest";

const { adminAuditLogs, users } = schema;
const org = organizationId(DEFAULT_ORGANIZATION_ID);

const credentialAuthorityForAdmin = (actorUserId: string) => ({
  organizationId: org,
  policyDecision: authorizeTenantAction({
    subject: { userId: actorUserId, personaRole: "admin", organizationId: org, membershipRole: "admin", membershipStatus: "active" },
    action: "tenant.write",
    resource: { kind: "organization", organizationId: org },
    context: { tenantId: org },
  }),
});

async function countCredentialAudits(targetEntityId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(adminAuditLogs)
    .where(sql`${adminAuditLogs.targetEntityId} = ${targetEntityId}
      AND ${adminAuditLogs.action} IN ('nurse.credential.verified', 'nurse.credential.rejected')`);
  return Number(row?.value ?? 0);
}

async function waitForBlockedNurseUpdates(expected: number) {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    const { rows } = await db.execute<{ waiting: string }>(sql`
      SELECT count(*)::text AS waiting
      FROM pg_stat_activity
      WHERE wait_event_type = 'Lock'
        AND query ILIKE '%update "nurses"%'
    `);
    if (Number(rows[0]?.waiting ?? 0) >= expected) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

describe.sequential("nurse credential CAS conflicts", () => {
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE admin_audit_logs RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nurse_locations RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nurses RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  });

  it("lets only one competing submitted transition commit audit evidence", async () => {
    const [adminUser] = await db
      .insert(users)
      .values({ email: "cas-admin@test.local", role: "admin" })
      .returning();
    const [applicantUser] = await db
      .insert(users)
      .values({ email: "cas-applicant@test.local", role: "patient" })
      .returning();
    const submitted = await submitNurseApplication({
      userId: applicantUser!.id,
      licenseNumber: "RN-CAS-001",
      licenseJurisdiction: "CA",
      specialization: "General",
    });
    const authority = credentialAuthorityForAdmin(adminUser!.id);
    let competing: Promise<unknown>[] = [];

    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM nurses WHERE id = ${submitted.id} FOR UPDATE`);
      competing = [
        verifyNurseCredential({
          actorUserId: adminUser!.id,
          nurseId: submitted.id,
          ...authority,
          licenseValidUntil: "2027-12-31T00:00:00.000Z",
          licenseJurisdiction: "CA",
        }),
        rejectNurseCredential({
          actorUserId: adminUser!.id,
          nurseId: submitted.id,
          ...authority,
          reason: "Competing review decision",
        }),
      ];
      await waitForBlockedNurseUpdates(2);
    });

    const outcomes = await Promise.allSettled(competing);
    const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
    const rejected = outcomes.filter((outcome) => outcome.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(NurseCredentialConflictError);
    expect(await countCredentialAudits(submitted.id)).toBe(1);
  });
});
