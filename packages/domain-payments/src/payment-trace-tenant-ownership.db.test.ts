import { db, schema, sql } from "@nurseconnect/database";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { recordPaymentAuthorizationTrace } from "./payment-trace";

const { paymentAuthorizations, serviceRequests, users } = schema;
const DEFAULT_ORG_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ORG_ID = "00000000-0000-4000-8000-000000000002";

describe.sequential("payment trace tenant ownership", () => {
  beforeAll(async () => {
    await db.execute(sql`SELECT 1`);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE payment_authorizations RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE service_requests RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  });

  it("rejects new payment rows for requests without tenant ownership", async () => {
    const [patient] = await db
      .insert(users)
      .values({ email: "missing-tenant-pay-patient@test.local", role: "patient" })
      .returning();

    const [request] = await db
      .insert(serviceRequests)
      .values({
        patientUserId: patient!.id,
        address: "500 Missing Tenant Ave",
        lat: "42.662900",
        lng: "21.165500",
      })
      .returning();

    await expect(recordPaymentAuthorizationTrace(db, {
      requestId: request!.id,
      amountCents: 15000,
      currency: "USD",
    }, request!)).rejects.toThrow("Payment trace requires tenant-owned request");

    expect(await db.select().from(paymentAuthorizations)).toHaveLength(0);
  });

  it("rejects forged request ownership even when every foreign key exists", async () => {
    await db.execute(sql`
      INSERT INTO organizations (id, name, slug, status)
      VALUES
        (${DEFAULT_ORG_ID}, 'Default', 'default-proof', 'active'),
        (${OTHER_ORG_ID}, 'Other', 'other-proof', 'active')
      ON CONFLICT (id) DO NOTHING
    `);
    const [requestPatient, otherPatient] = await db.insert(users).values([
      { email: "request-owner@test.local", role: "patient" },
      { email: "forged-owner@test.local", role: "patient" },
    ]).returning();
    const [request] = await db.insert(serviceRequests).values({
      patientUserId: requestPatient!.id,
      organizationId: DEFAULT_ORG_ID,
      address: "600 Ownership Proof Ave",
      lat: "42.662900",
      lng: "21.165500",
    }).returning();

    await expect(recordPaymentAuthorizationTrace(db, {
      requestId: request!.id,
      amountCents: 15000,
      currency: "USD",
    }, {
      ...request!,
      organizationId: OTHER_ORG_ID,
      patientUserId: otherPatient!.id,
    })).rejects.toThrow(/payment_authorizations_request_owner_fk/);

    expect(await db.select().from(paymentAuthorizations)).toHaveLength(0);
  });
});
