import { db, schema, sql } from "@nurseconnect/database";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getAdminActiveRequestQueue } from "./active-request-queue";

const { referralPartners, serviceRequests, users } = schema;

describe.sequential("admin active request queue", () => {
  beforeAll(async () => {
    await db.execute(sql`SELECT 1`);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE service_request_events RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE service_requests RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE referral_partners RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  });

  it("identifies partner-originated demand with partner context", async () => {
    const [partner, patient] = await db
      .insert(users)
      .values([
        { email: "partner@test.local", role: "referral_partner" },
        { email: "patient@test.local", role: "patient" },
      ])
      .returning();

    await db.insert(referralPartners).values({
      userId: partner!.id,
      organizationName: "City Clinic",
      status: "active",
    });

    await db.insert(serviceRequests).values({
      patientUserId: patient!.id,
      address: "Partner Queue Street",
      lat: "42.6629",
      lng: "21.1655",
      status: "open",
      requestType: "same_day",
      referralSource: "partner",
      referralPartnerId: partner!.id,
      careType: "wound_care",
    });

    const queue = await getAdminActiveRequestQueue(db);

    expect(queue.items[0]).toMatchObject({
      referralSource: "partner",
      partnerLabel: "City Clinic",
    });
  });
});
