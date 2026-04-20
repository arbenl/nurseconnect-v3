import { expect, test } from "@playwright/test";

import {
  getDbClient,
  resetDb,
  seedNurse,
  seedNurseLocation,
  seedReferralPartnerProfile,
} from "../e2e-utils/db";
import { createTestUser, loginTestUser } from "../e2e-utils/helpers";

async function getRequestRecord(requestId: string) {
  const client = getDbClient();
  await client.connect();

  try {
    const result = await client.query<{
      id: string;
      patient_user_id: string;
      assigned_nurse_user_id: string | null;
      referral_source: "consumer" | "partner";
      referral_partner_id: string | null;
      status: string;
    }>(
      `SELECT id, patient_user_id, assigned_nurse_user_id, referral_source, referral_partner_id, status
         FROM service_requests
        WHERE id = $1`,
      [requestId],
    );

    return result.rows[0] ?? null;
  } finally {
    await client.end();
  }
}

async function getUserRecord(userId: string) {
  const client = getDbClient();
  await client.connect();

  try {
    const result = await client.query<{
      id: string;
      email: string;
      role: "patient" | "nurse" | "admin" | "referral_partner";
    }>("SELECT id, email, role FROM users WHERE id = $1", [userId]);

    return result.rows[0] ?? null;
  } finally {
    await client.end();
  }
}

test.describe("Partner Requests API", () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test("partner can create a request through the shared allocation path", async ({ request }) => {
    const nurseEmail = `partner-nurse-${Date.now()}@test.local`;
    const { userId: nurseUserId } = await createTestUser(request, nurseEmail, "Partner Nurse", "nurse");
    await seedNurse({
      userId: nurseUserId,
      licenseNumber: "RN-PARTNER-001",
      specialization: "General",
      isAvailable: true,
    });
    await seedNurseLocation({
      nurseUserId,
      lat: "42.6629",
      lng: "21.1655",
    });

    const partnerEmail = `partner-${Date.now()}@test.local`;
    const { userId: partnerUserId } = await createTestUser(
      request,
      partnerEmail,
      "Referral Partner",
      "referral_partner",
    );
    await seedReferralPartnerProfile({
      userId: partnerUserId,
      organizationName: "City Clinic",
      status: "active",
    });

    await loginTestUser(request, partnerEmail);

    const response = await request.post("/api/partner/requests", {
      data: {
        patient: {
          email: `referred-${Date.now()}@test.local`,
          firstName: "Referred",
          lastName: "Patient",
          phone: "+38344111222",
          city: "Pristina",
        },
        address: "123 Partner Intake St, Pristina",
        lat: 42.6629,
        lng: 21.1655,
        requestType: "same_day",
        careType: "wound_care",
      },
    });

    expect(response.ok(), `Partner request failed: ${await response.text()}`).toBeTruthy();
    const data = await response.json();

    expect(data.referralSource).toBe("partner");
    expect(data.referralPartnerId).toBe(partnerUserId);
    expect(data.assignedNurseUserId).toBe(nurseUserId);
    expect(data.status).toBe("assigned");

    const requestRecord = await getRequestRecord(data.id);
    expect(requestRecord).toMatchObject({
      id: data.id,
      referral_source: "partner",
      referral_partner_id: partnerUserId,
      assigned_nurse_user_id: nurseUserId,
      status: "assigned",
    });

    const patientRecord = await getUserRecord(requestRecord!.patient_user_id);
    expect(patientRecord).toMatchObject({
      role: "patient",
    });
  });

  test("inactive partner profiles cannot submit partner requests", async ({ request }) => {
    const partnerEmail = `partner-inactive-${Date.now()}@test.local`;
    const { userId: partnerUserId } = await createTestUser(
      request,
      partnerEmail,
      "Referral Partner",
      "referral_partner",
    );
    await seedReferralPartnerProfile({
      userId: partnerUserId,
      organizationName: "City Clinic",
      status: "inactive",
    });

    await loginTestUser(request, partnerEmail);

    const response = await request.post("/api/partner/requests", {
      data: {
        patient: {
          email: `referred-inactive-${Date.now()}@test.local`,
          firstName: "Referred",
          lastName: "Patient",
        },
        address: "123 Partner Intake St, Pristina",
        lat: 42.6629,
        lng: 21.1655,
      },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Referral partner profile is inactive",
    });
  });

  test("partner list and detail are limited to the actor's own referrals", async ({ request }) => {
    const partnerEmail = `partner-list-${Date.now()}@test.local`;
    const { userId: partnerUserId } = await createTestUser(
      request,
      partnerEmail,
      "Referral Partner",
      "referral_partner",
    );
    await seedReferralPartnerProfile({
      userId: partnerUserId,
      organizationName: "City Clinic",
      status: "active",
    });

    const otherPartnerEmail = `partner-other-${Date.now()}@test.local`;
    const { userId: otherPartnerUserId } = await createTestUser(
      request,
      otherPartnerEmail,
      "Other Partner",
      "referral_partner",
    );
    await seedReferralPartnerProfile({
      userId: otherPartnerUserId,
      organizationName: "County Clinic",
      status: "active",
    });

    await loginTestUser(request, partnerEmail);

    const ownCreate = await request.post("/api/partner/requests", {
      data: {
        patient: {
          email: `own-referred-${Date.now()}@test.local`,
          firstName: "Own",
          lastName: "Patient",
          phone: "+38344111222",
          city: "Pristina",
        },
        address: "Own Partner Street",
        lat: 42.6629,
        lng: 21.1655,
      },
    });
    expect(ownCreate.ok(), `Own partner request failed: ${await ownCreate.text()}`).toBeTruthy();
    const ownRequest = await ownCreate.json();

    await request.post("/api/auth/sign-out", { data: {} });
    await loginTestUser(request, otherPartnerEmail);

    const otherCreate = await request.post("/api/partner/requests", {
      data: {
        patient: {
          email: `other-referred-${Date.now()}@test.local`,
          firstName: "Other",
          lastName: "Patient",
          phone: "+38344111223",
          city: "Pristina",
        },
        address: "Other Partner Street",
        lat: 42.6629,
        lng: 21.1655,
      },
    });
    expect(otherCreate.ok(), `Other partner request failed: ${await otherCreate.text()}`).toBeTruthy();
    const otherRequest = await otherCreate.json();

    await request.post("/api/auth/sign-out", { data: {} });
    await loginTestUser(request, partnerEmail);

    const listResponse = await request.get("/api/partner/requests");
    expect(listResponse.ok(), `Partner list failed: ${await listResponse.text()}`).toBeTruthy();
    const list = await listResponse.json();

    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({
      id: ownRequest.id,
      address: "Own Partner Street",
    });

    const detailResponse = await request.get(`/api/partner/requests/${ownRequest.id}`);
    expect(detailResponse.ok(), `Partner detail failed: ${await detailResponse.text()}`).toBeTruthy();
    const detail = await detailResponse.json();

    expect(detail).toMatchObject({
      id: ownRequest.id,
      patient: {
        firstName: "Own",
        lastName: "Patient",
      },
    });
    expect(detail).not.toHaveProperty("assignedNurseUserId");

    const forbiddenDetail = await request.get(`/api/partner/requests/${otherRequest.id}`);
    expect(forbiddenDetail.status()).toBe(404);
  });

  test("admin queue shows partner context for partner-originated demand", async ({ request }) => {
    const partnerEmail = `partner-admin-view-${Date.now()}@test.local`;
    const { userId: partnerUserId } = await createTestUser(
      request,
      partnerEmail,
      "Referral Partner",
      "referral_partner",
    );
    await seedReferralPartnerProfile({
      userId: partnerUserId,
      organizationName: "City Clinic",
      status: "active",
    });

    await loginTestUser(request, partnerEmail);
    const createResponse = await request.post("/api/partner/requests", {
      data: {
        patient: {
          email: `admin-view-patient-${Date.now()}@test.local`,
          firstName: "Queue",
          lastName: "Patient",
        },
        address: "Admin Queue Street",
        lat: 42.6629,
        lng: 21.1655,
      },
    });
    expect(createResponse.ok(), `Partner request failed: ${await createResponse.text()}`).toBeTruthy();

    await request.post("/api/auth/sign-out", { data: {} });

    const adminEmail = `admin-partner-queue-${Date.now()}@test.local`;
    await createTestUser(request, adminEmail, "Role Admin", "admin");
    await loginTestUser(request, adminEmail);

    const queueResponse = await request.get("/api/admin/requests/active");
    expect(queueResponse.ok(), `Admin queue failed: ${await queueResponse.text()}`).toBeTruthy();
    const queue = await queueResponse.json();

    expect(queue.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          referralSource: "partner",
          partnerLabel: "City Clinic",
        }),
      ]),
    );
  });
});
