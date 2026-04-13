import { expect, test } from "@playwright/test";

import { getDbClient, resetDb, seedNurse } from "../e2e-utils/db";
import { createTestUser, loginTestUser } from "../e2e-utils/helpers";

async function submitNurseApplication(request: Parameters<typeof test>[0]["request"], email: string) {
  await loginTestUser(request, email);
  const response = await request.post("/api/me/become-nurse", {
    data: {
      licenseNumber: "RN-APPLY-001",
      licenseJurisdiction: "CA",
      specialization: "General",
    },
  });
  expect(response.ok(), `Application failed: ${await response.text()}`).toBeTruthy();
  await request.post("/api/auth/sign-out", { data: {} });
}

async function getNurseRecord(userId: string) {
  const client = getDbClient();
  await client.connect();
  try {
    const result = await client.query<{
      id: string;
      status: string;
      is_available: boolean;
      user_role: string;
      verified_by: string | null;
      verified_at: string | null;
      license_valid_until: string | null;
      suspension_reason: string | null;
    }>(
      `SELECT
          n.id,
          n.status,
          n.is_available,
          u.role AS user_role,
          n.verified_by,
          n.verified_at,
          n.license_valid_until,
          n.suspension_reason
        FROM nurses n
        INNER JOIN users u ON u.id = n.user_id
        WHERE n.user_id = $1`,
      [userId],
    );
    return result.rows[0] ?? null;
  } finally {
    await client.end();
  }
}

async function countAdminAuditActions(action: string, targetEntityId: string) {
  const client = getDbClient();
  await client.connect();
  try {
    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM admin_audit_logs
        WHERE action = $1
          AND target_entity_id = $2`,
      [action, targetEntityId],
    );
    return Number(result.rows[0]?.count ?? "0");
  } finally {
    await client.end();
  }
}

test.describe("Admin Nurse Credential API", () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test("admin lists submitted applicants and verifies a nurse", async ({ request }) => {
    const adminEmail = `admin-verify-${Date.now()}@test.local`;
    await createTestUser(request, adminEmail, "Verify Admin", "admin");

    const applicantEmail = `applicant-verify-${Date.now()}@test.local`;
    const { userId: applicantUserId } = await createTestUser(
      request,
      applicantEmail,
      "Verify Applicant",
      "patient",
    );
    await submitNurseApplication(request, applicantEmail);

    await loginTestUser(request, adminEmail);

    const queueResponse = await request.get("/api/admin/nurses");
    expect(queueResponse.ok(), `Queue failed: ${await queueResponse.text()}`).toBeTruthy();
    const queueBody = await queueResponse.json();
    const queueItem = queueBody.items.find((item: { userId: string }) => item.userId === applicantUserId);
    expect(queueItem).toBeTruthy();
    expect(queueItem.status).toBe("submitted");

    const verifyResponse = await request.post(`/api/admin/nurses/${queueItem.id}/verify`, {
      data: {
        licenseValidUntil: "2027-12-31T00:00:00.000Z",
        licenseJurisdiction: "CA",
      },
    });
    expect(verifyResponse.ok(), `Verify failed: ${await verifyResponse.text()}`).toBeTruthy();

    const nurseRecord = await getNurseRecord(applicantUserId);
    expect(nurseRecord).toBeTruthy();
    expect(nurseRecord?.status).toBe("verified");
    expect(nurseRecord?.user_role).toBe("nurse");
    expect(nurseRecord?.verified_by).toBeTruthy();
    expect(nurseRecord?.verified_at).toBeTruthy();
    expect(nurseRecord?.license_valid_until).toBeTruthy();
    expect(await countAdminAuditActions("nurse.credential.verified", queueItem.id)).toBe(1);
  });

  test("admin can reject a submitted applicant without role promotion", async ({ request }) => {
    const adminEmail = `admin-reject-${Date.now()}@test.local`;
    await createTestUser(request, adminEmail, "Reject Admin", "admin");

    const applicantEmail = `applicant-reject-${Date.now()}@test.local`;
    const { userId: applicantUserId } = await createTestUser(
      request,
      applicantEmail,
      "Reject Applicant",
      "patient",
    );
    await submitNurseApplication(request, applicantEmail);

    const nurseRecordBefore = await getNurseRecord(applicantUserId);
    expect(nurseRecordBefore).toBeTruthy();

    await loginTestUser(request, adminEmail);
    const rejectResponse = await request.post(`/api/admin/nurses/${nurseRecordBefore!.id}/reject`, {
      data: { reason: "Incomplete credentials" },
    });
    expect(rejectResponse.ok(), `Reject failed: ${await rejectResponse.text()}`).toBeTruthy();

    const nurseRecord = await getNurseRecord(applicantUserId);
    expect(nurseRecord?.status).toBe("rejected");
    expect(nurseRecord?.user_role).toBe("patient");
    expect(await countAdminAuditActions("nurse.credential.rejected", nurseRecordBefore!.id)).toBe(1);
  });

  test("admin can suspend a verified nurse and force them offline", async ({ request }) => {
    const adminEmail = `admin-suspend-${Date.now()}@test.local`;
    await createTestUser(request, adminEmail, "Suspend Admin", "admin");

    const nurseEmail = `verified-nurse-${Date.now()}@test.local`;
    const { userId: nurseUserId } = await createTestUser(
      request,
      nurseEmail,
      "Verified Nurse",
      "nurse",
    );
    await seedNurse({
      userId: nurseUserId,
      licenseNumber: "RN-SUSPEND-001",
      specialization: "ICU",
      isAvailable: true,
      status: "verified",
      licenseJurisdiction: "CA",
      licenseValidUntil: "2027-12-31T00:00:00.000Z",
    });

    const nurseRecordBefore = await getNurseRecord(nurseUserId);
    expect(nurseRecordBefore).toBeTruthy();

    await loginTestUser(request, adminEmail);
    const suspendResponse = await request.post(`/api/admin/nurses/${nurseRecordBefore!.id}/suspend`, {
      data: { reason: "Compliance hold" },
    });
    expect(suspendResponse.ok(), `Suspend failed: ${await suspendResponse.text()}`).toBeTruthy();

    const nurseRecord = await getNurseRecord(nurseUserId);
    expect(nurseRecord?.status).toBe("suspended");
    expect(nurseRecord?.is_available).toBe(false);
    expect(nurseRecord?.user_role).toBe("nurse");
    expect(nurseRecord?.suspension_reason).toBe("Compliance hold");
    expect(await countAdminAuditActions("nurse.credential.suspended", nurseRecordBefore!.id)).toBe(1);
  });
});
