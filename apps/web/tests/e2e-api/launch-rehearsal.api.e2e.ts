import { expect, test } from "@playwright/test";

import {
  resetDb,
  seedNurse,
  seedNurseLocation,
  seedReferralPartnerProfile,
} from "../e2e-utils/db";
import { createTestUser, loginTestUser, markProfileComplete } from "../e2e-utils/helpers";

test.describe("Launch Rehearsal API", () => {
  test.setTimeout(120000);

  test.beforeEach(async () => {
    await resetDb();
  });

  test("rehearses the controlled launch operational path", async ({ request }) => {
    const suffix = Date.now();

    const healthResponse = await request.get("/api/health/db");
    expect(healthResponse.ok(), `Health check failed: ${await healthResponse.text()}`).toBeTruthy();
    await expect(healthResponse.json()).resolves.toEqual({ ok: true, db: "ok" });

    const adminEmail = `launch-admin-${suffix}@test.local`;
    await createTestUser(request, adminEmail, "Launch Admin", "admin");

    const nurseEmail = `launch-nurse-${suffix}@test.local`;
    const { userId: nurseUserId } = await createTestUser(
      request,
      nurseEmail,
      "Launch Nurse",
      "nurse",
    );
    await seedNurse({
      userId: nurseUserId,
      licenseNumber: `RN-LAUNCH-${suffix}`,
      specialization: "General",
      isAvailable: true,
    });
    await seedNurseLocation({
      nurseUserId,
      lat: "42.6629",
      lng: "21.1655",
    });

    const partnerEmail = `launch-partner-${suffix}@test.local`;
    const { userId: partnerUserId } = await createTestUser(
      request,
      partnerEmail,
      "Launch Partner",
      "referral_partner",
    );
    await seedReferralPartnerProfile({
      userId: partnerUserId,
      organizationName: "Launch Clinic",
      status: "active",
    });

    const patientEmail = `launch-patient-${suffix}@test.local`;
    await createTestUser(request, patientEmail, "Launch Patient", "patient");
    await markProfileComplete(patientEmail);

    await loginTestUser(request, adminEmail);

    const adminPing = await request.get("/api/admin/ping");
    expect(adminPing.ok(), `Admin ping failed: ${await adminPing.text()}`).toBeTruthy();
    await expect(adminPing.json()).resolves.toMatchObject({
      ok: true,
      user: { role: "admin" },
    });

    const serviceAreasResponse = await request.get("/api/admin/service-areas");
    expect(
      serviceAreasResponse.ok(),
      `Service areas failed: ${await serviceAreasResponse.text()}`,
    ).toBeTruthy();
    const serviceAreas = await serviceAreasResponse.json();
    expect(serviceAreas.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: "active" })]),
    );

    await request.post("/api/auth/sign-out", { data: {} });
    await loginTestUser(request, patientEmail);

    const createRequest = await request.post("/api/requests", {
      data: {
        address: "Launch Rehearsal Patient St, Pristina",
        lat: 42.6629,
        lng: 21.1655,
        requestType: "same_day",
        careType: "wound_care",
      },
    });
    expect(createRequest.ok(), `Patient request failed: ${await createRequest.text()}`).toBeTruthy();
    const patientRequest = await createRequest.json();
    expect(patientRequest).toMatchObject({
      status: "assigned",
      assignedNurseUserId: nurseUserId,
    });

    await request.post("/api/auth/sign-out", { data: {} });
    await loginTestUser(request, nurseEmail);

    const acceptResponse = await request.post(`/api/requests/${patientRequest.id}/accept`, {
      data: {},
    });
    expect(acceptResponse.ok(), `Accept failed: ${await acceptResponse.text()}`).toBeTruthy();
    await expect(acceptResponse.json()).resolves.toMatchObject({
      request: { status: "accepted" },
    });

    const enrouteResponse = await request.post(`/api/requests/${patientRequest.id}/enroute`, {
      data: {},
    });
    expect(enrouteResponse.ok(), `Enroute failed: ${await enrouteResponse.text()}`).toBeTruthy();
    await expect(enrouteResponse.json()).resolves.toMatchObject({
      request: { status: "enroute" },
    });

    const completeResponse = await request.post(`/api/requests/${patientRequest.id}/complete`, {
      data: {},
    });
    expect(
      completeResponse.ok(),
      `Complete failed: ${await completeResponse.text()}`,
    ).toBeTruthy();
    await expect(completeResponse.json()).resolves.toMatchObject({
      request: { status: "completed" },
    });

    await request.post("/api/auth/sign-out", { data: {} });
    await loginTestUser(request, adminEmail);

    const timelineResponse = await request.get(`/api/requests/${patientRequest.id}/events`);
    expect(
      timelineResponse.ok(),
      `Timeline failed: ${await timelineResponse.text()}`,
    ).toBeTruthy();
    const timeline = await timelineResponse.json();
    expect(timeline.map((event: { type: string }) => event.type)).toEqual([
      "request_created",
      "request_assigned",
      "request_accepted",
      "request_enroute",
      "request_completed",
    ]);

    const recordAuthorization = await request.post(
      `/api/admin/requests/${patientRequest.id}/payments`,
      {
        data: {
          kind: "authorization",
          action: "record",
          amountCents: 15000,
          currency: "USD",
          provider: "manual",
          providerReference: `launch-auth-${suffix}`,
        },
      },
    );
    expect(
      recordAuthorization.ok(),
      `Record authorization failed: ${await recordAuthorization.text()}`,
    ).toBeTruthy();

    const captureAuthorization = await request.post(
      `/api/admin/requests/${patientRequest.id}/payments`,
      {
        data: {
          kind: "authorization",
          action: "capture",
          providerReference: `launch-capture-${suffix}`,
        },
      },
    );
    expect(
      captureAuthorization.ok(),
      `Capture authorization failed: ${await captureAuthorization.text()}`,
    ).toBeTruthy();

    const recordPayout = await request.post(`/api/admin/requests/${patientRequest.id}/payments`, {
      data: {
        kind: "payout",
        action: "record",
        nurseUserId,
        amountCents: 9000,
        currency: "USD",
        provider: "manual",
      },
    });
    expect(recordPayout.ok(), `Record payout failed: ${await recordPayout.text()}`).toBeTruthy();

    const markPaid = await request.post(`/api/admin/requests/${patientRequest.id}/payments`, {
      data: {
        kind: "payout",
        action: "mark_paid",
        providerReference: `launch-payout-${suffix}`,
      },
    });
    expect(markPaid.ok(), `Mark paid failed: ${await markPaid.text()}`).toBeTruthy();
    await expect(markPaid.json()).resolves.toMatchObject({
      authorization: { status: "captured" },
      payout: { status: "paid", nurseUserId },
    });

    await request.post("/api/auth/sign-out", { data: {} });
    await loginTestUser(request, partnerEmail);

    const partnerRequestResponse = await request.post("/api/partner/requests", {
      data: {
        patient: {
          email: `launch-referred-${suffix}@test.local`,
          firstName: "Launch",
          lastName: "Referral",
          phone: "+38344111222",
          city: "Pristina",
        },
        address: "Launch Partner Intake St, Pristina",
        lat: 42.6629,
        lng: 21.1655,
        requestType: "same_day",
        careType: "wound_care",
      },
    });
    expect(
      partnerRequestResponse.ok(),
      `Partner request failed: ${await partnerRequestResponse.text()}`,
    ).toBeTruthy();
    const partnerRequest = await partnerRequestResponse.json();
    expect(partnerRequest).toMatchObject({
      referralSource: "partner",
      referralPartnerId: partnerUserId,
    });

    const partnerListResponse = await request.get("/api/partner/requests");
    expect(
      partnerListResponse.ok(),
      `Partner list failed: ${await partnerListResponse.text()}`,
    ).toBeTruthy();
    const partnerList = await partnerListResponse.json();
    expect(partnerList.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: partnerRequest.id })]),
    );

    const partnerDetailResponse = await request.get(`/api/partner/requests/${partnerRequest.id}`);
    expect(
      partnerDetailResponse.ok(),
      `Partner detail failed: ${await partnerDetailResponse.text()}`,
    ).toBeTruthy();
    await expect(partnerDetailResponse.json()).resolves.toMatchObject({
      id: partnerRequest.id,
      patient: {
        firstName: "Launch",
        lastName: "Referral",
      },
    });

    await request.post("/api/auth/sign-out", { data: {} });
    const exceptionPatientEmail = `launch-exception-patient-${suffix}@test.local`;
    await createTestUser(request, exceptionPatientEmail, "Launch Exception Patient", "patient");
    await markProfileComplete(exceptionPatientEmail);
    await loginTestUser(request, exceptionPatientEmail);

    const exceptionCreate = await request.post("/api/requests", {
      data: {
        address: "Launch Exception St, Pristina",
        lat: 42.6629,
        lng: 21.1655,
        requestType: "same_day",
      },
    });
    expect(
      exceptionCreate.ok(),
      `Exception setup request failed: ${await exceptionCreate.text()}`,
    ).toBeTruthy();
    const exceptionRequest = await exceptionCreate.json();

    await request.post("/api/auth/sign-out", { data: {} });
    await loginTestUser(request, adminEmail);

    const needsReview = await request.post(`/api/admin/requests/${exceptionRequest.id}/triage`, {
      data: { action: "needs_review", reason: "Launch rehearsal exception review" },
    });
    expect(needsReview.ok(), `Needs review failed: ${await needsReview.text()}`).toBeTruthy();
    await expect(needsReview.json()).resolves.toMatchObject({
      request: { status: "needs_review" },
    });

    const decline = await request.post(`/api/admin/requests/${exceptionRequest.id}/triage`, {
      data: { action: "decline", reason: "Launch rehearsal decline reason" },
    });
    expect(decline.ok(), `Decline failed: ${await decline.text()}`).toBeTruthy();
    await expect(decline.json()).resolves.toMatchObject({
      request: { status: "declined" },
    });

    const reopen = await request.post(`/api/admin/requests/${exceptionRequest.id}/triage`, {
      data: { action: "reopen", reason: "Launch rehearsal reopen" },
    });
    expect(reopen.ok(), `Reopen failed: ${await reopen.text()}`).toBeTruthy();
    await expect(reopen.json()).resolves.toMatchObject({
      request: { status: "open", assignedNurseUserId: null },
    });
  });
});
