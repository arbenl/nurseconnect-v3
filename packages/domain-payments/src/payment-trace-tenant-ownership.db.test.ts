import { db, schema, sql } from "@nurseconnect/database";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { recordPaymentAuthorizationTrace } from "./payment-trace";

const { paymentAuthorizations, serviceRequests, users } = schema;

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
});
