import { db, eq, schema, sql } from "@nurseconnect/database";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ReferralPartnerNotFoundError } from "./errors";
import {
  getPartnerRequestDetail,
  listPartnerRequests,
} from "./partner-request-projections";

const { referralPartners, serviceRequests, users } = schema;

describe.sequential("partner request projections", () => {
  beforeAll(async () => {
    await db.execute(sql`SELECT 1`);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE service_request_events RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE service_requests RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE referral_partners RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  });

  it("lists only the actor's own referrals", async () => {
    const [partnerOne, partnerTwo, patientOne, patientTwo] = await db
      .insert(users)
      .values([
        { email: "partner-one@test.local", role: "referral_partner" },
        { email: "partner-two@test.local", role: "referral_partner" },
        {
          email: "patient-one@test.local",
          role: "patient",
          firstName: "Patient",
          lastName: "One",
        },
        {
          email: "patient-two@test.local",
          role: "patient",
          firstName: "Patient",
          lastName: "Two",
        },
      ])
      .returning();

    await db.insert(referralPartners).values([
      { userId: partnerOne!.id, organizationName: "City Clinic", status: "active" },
      { userId: partnerTwo!.id, organizationName: "County Clinic", status: "active" },
    ]);

    await db.insert(serviceRequests).values([
      {
        patientUserId: patientOne!.id,
        address: "Partner One Street",
        lat: "42.6629",
        lng: "21.1655",
        status: "open",
        requestType: "same_day",
        referralSource: "partner",
        referralPartnerId: partnerOne!.id,
        careType: "wound_care",
      },
      {
        patientUserId: patientTwo!.id,
        address: "Partner Two Street",
        lat: "42.6629",
        lng: "21.1655",
        status: "assigned",
        requestType: "scheduled",
        referralSource: "partner",
        referralPartnerId: partnerTwo!.id,
        careType: "iv_therapy",
      },
    ]);

    const items = await listPartnerRequests(db, { actorUserId: partnerOne!.id });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      address: "Partner One Street",
      status: "received",
      careType: "wound_care",
    });
  });

  it("blocks cross-partner detail access", async () => {
    const [partnerOne, partnerTwo, patientOne] = await db
      .insert(users)
      .values([
        { email: "partner-one@test.local", role: "referral_partner" },
        { email: "partner-two@test.local", role: "referral_partner" },
        {
          email: "patient-one@test.local",
          role: "patient",
          firstName: "Patient",
          lastName: "One",
        },
      ])
      .returning();

    await db.insert(referralPartners).values([
      { userId: partnerOne!.id, organizationName: "City Clinic", status: "active" },
      { userId: partnerTwo!.id, organizationName: "County Clinic", status: "active" },
    ]);

    const [request] = await db
      .insert(serviceRequests)
      .values({
        patientUserId: patientOne!.id,
        address: "Partner One Street",
        lat: "42.6629",
        lng: "21.1655",
        status: "open",
        requestType: "same_day",
        referralSource: "partner",
        referralPartnerId: partnerOne!.id,
      })
      .returning();

    await expect(
      getPartnerRequestDetail(db, {
        actorUserId: partnerTwo!.id,
        requestId: request!.id,
      }),
    ).rejects.toThrow(ReferralPartnerNotFoundError);
  });

  it("returns a limited detail projection", async () => {
    const [partner, patient] = await db
      .insert(users)
      .values([
        { email: "partner@test.local", role: "referral_partner" },
        {
          email: "patient@test.local",
          role: "patient",
          firstName: "Patient",
          lastName: "One",
          phone: "+38344123456",
          city: "Pristina",
        },
      ])
      .returning();

    await db.insert(referralPartners).values({
      userId: partner!.id,
      organizationName: "City Clinic",
      status: "active",
    });

    const [request] = await db
      .insert(serviceRequests)
      .values({
        patientUserId: patient!.id,
        address: "Partner Detail Street",
        lat: "42.6629",
        lng: "21.1655",
        status: "assigned",
        requestType: "scheduled",
        scheduledFor: new Date("2027-01-15T09:30:00.000Z"),
        referralSource: "partner",
        referralPartnerId: partner!.id,
        careType: "wound_care",
      })
      .returning();

    const detail = await getPartnerRequestDetail(db, {
      actorUserId: partner!.id,
      requestId: request!.id,
    });

    expect(detail).toMatchObject({
      id: request!.id,
      status: "scheduled",
      address: "Partner Detail Street",
      patient: {
        firstName: "Patient",
        lastName: "One",
        phone: "+38344123456",
        city: "Pristina",
      },
    });
    expect(detail).not.toHaveProperty("assignedNurseUserId");
    expect(detail).not.toHaveProperty("referralPartnerId");
  });
});
