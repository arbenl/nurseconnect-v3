import { db, schema, sql } from "@nurseconnect/database";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  getAdminRequestPaymentTrace,
  recordNursePayoutTrace,
  recordPaymentAuthorizationTrace,
  updateNursePayoutTraceStatus,
  updatePaymentAuthorizationTraceStatus,
} from "./payment-trace";
import { PaymentTraceConflictError } from "./errors";
const { nursePayouts, nurses, paymentAuthorizations, serviceRequests, users } = schema;
const DEFAULT_TENANT = { organizationId: "00000000-0000-4000-8000-000000000001", branchId: "00000000-0000-4000-8000-000000000101" };
describe.sequential("payment traceability", () => {
  beforeAll(async () => {
    await db.execute(sql`SELECT 1`);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE nurse_payouts RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE payment_authorizations RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE service_requests RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nurses RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
    await db.execute(sql`INSERT INTO organizations (id, name, slug, status) VALUES (${DEFAULT_TENANT.organizationId}, 'NurseConnect Default Organization', 'nurseconnect-default', 'active') ON CONFLICT (id) DO NOTHING`);
    await db.execute(sql`INSERT INTO branches (id, organization_id, name, slug, status, jurisdiction_country, jurisdiction_region) VALUES (${DEFAULT_TENANT.branchId}, ${DEFAULT_TENANT.organizationId}, 'NurseConnect Default Branch', 'nurseconnect-default-branch', 'active', 'US', 'default-launch-region') ON CONFLICT (id) DO NOTHING`);
  });

  it("records, captures, and exposes a private-pay authorization trace", async () => {
    const [patient] = await db
      .insert(users)
      .values({ email: "pay-patient@test.local", role: "patient" })
      .returning();

    const [request] = await db
      .insert(serviceRequests)
      .values({
        patientUserId: patient!.id,
        ...DEFAULT_TENANT,
        address: "100 Private Pay Ave",
        lat: "42.662900",
        lng: "21.165500",
      })
      .returning();

    await recordPaymentAuthorizationTrace(db, {
      requestId: request!.id,
      amountCents: 15000,
      currency: "USD",
      provider: "manual",
      providerReference: "auth-001",
    }, request!);

    const captured = await updatePaymentAuthorizationTraceStatus(db, {
      requestId: request!.id,
      action: "capture",
      providerReference: "capture-001",
    });

    expect(captured.status).toBe("captured");
    expect(captured.organizationId).toBe(DEFAULT_TENANT.organizationId);
    expect(captured.capturedAt).toBeInstanceOf(Date);

    const trace = await getAdminRequestPaymentTrace(db, request!.id, request!);
    expect(trace.authorization).toMatchObject({
      requestId: request!.id,
      patientUserId: patient!.id,
      status: "captured",
      amountCents: 15000,
      currency: "USD",
      providerReference: "capture-001",
    });
    expect(trace.payout).toBeNull();
  });

  it("records and marks a completed request payout paid", async () => {
    const [patient, nurseUser] = await db
      .insert(users)
      .values([
        { email: "payout-patient@test.local", role: "patient" },
        { email: "payout-nurse@test.local", role: "nurse" },
      ])
      .returning();

    await db.insert(nurses).values({
      userId: nurseUser!.id,
      licenseNumber: "RN-PAYOUT",
      status: "verified",
    });

    const [request] = await db
      .insert(serviceRequests)
      .values({
        patientUserId: patient!.id,
        assignedNurseUserId: nurseUser!.id,
        ...DEFAULT_TENANT,
        status: "completed",
        address: "200 Payout Trace Ave",
        lat: "42.662900",
        lng: "21.165500",
        completedAt: new Date("2026-04-20T12:00:00.000Z"),
      })
      .returning();

    await recordNursePayoutTrace(db, {
      requestId: request!.id,
      nurseUserId: nurseUser!.id,
      amountCents: 9000,
      currency: "USD",
      provider: "manual",
    }, request!);

    const paid = await updateNursePayoutTraceStatus(db, {
      requestId: request!.id,
      action: "mark_paid",
      providerReference: "payout-001",
    });

    expect(paid.status).toBe("paid");
    expect(paid.organizationId).toBe(DEFAULT_TENANT.organizationId);
    expect(paid.paidAt).toBeInstanceOf(Date);

    const trace = await getAdminRequestPaymentTrace(db, request!.id, request!);
    expect(trace.payout).toMatchObject({
      requestId: request!.id,
      nurseUserId: nurseUser!.id,
      status: "paid",
      amountCents: 9000,
      providerReference: "payout-001",
    });
  });

  it("rejects payout trace records before the request is completed", async () => {
    const [patient, nurseUser] = await db
      .insert(users)
      .values([
        { email: "early-payout-patient@test.local", role: "patient" },
        { email: "early-payout-nurse@test.local", role: "nurse" },
      ])
      .returning();

    const [request] = await db
      .insert(serviceRequests)
      .values({
        patientUserId: patient!.id,
        assignedNurseUserId: nurseUser!.id,
        ...DEFAULT_TENANT,
        status: "accepted",
        address: "300 Early Payout Ave",
        lat: "42.662900",
        lng: "21.165500",
      })
      .returning();

    await expect(
      recordNursePayoutTrace(db, {
        requestId: request!.id,
        nurseUserId: nurseUser!.id,
        amountCents: 9000,
        currency: "USD",
      }, request!),
    ).rejects.toThrow(PaymentTraceConflictError);
  });

  it("keeps a single authorization and payout trace per request", async () => {
    const [patient, nurseUser] = await db
      .insert(users)
      .values([
        { email: "unique-pay-patient@test.local", role: "patient" },
        { email: "unique-pay-nurse@test.local", role: "nurse" },
      ])
      .returning();

    const [request] = await db
      .insert(serviceRequests)
      .values({
        patientUserId: patient!.id,
        assignedNurseUserId: nurseUser!.id,
        ...DEFAULT_TENANT,
        status: "completed",
        address: "400 Unique Trace Ave",
        lat: "42.662900",
        lng: "21.165500",
        completedAt: new Date("2026-04-20T12:00:00.000Z"),
      })
      .returning();

    await recordPaymentAuthorizationTrace(db, {
      requestId: request!.id,
      amountCents: 15000,
      currency: "USD",
    }, request!);
    await recordNursePayoutTrace(db, {
      requestId: request!.id,
      nurseUserId: nurseUser!.id,
      amountCents: 9000,
      currency: "USD",
    }, request!);

    await expect(
      recordPaymentAuthorizationTrace(db, {
        requestId: request!.id,
        amountCents: 15000,
        currency: "USD",
      }, request!),
    ).rejects.toThrow(PaymentTraceConflictError);
    await expect(
      recordNursePayoutTrace(db, {
        requestId: request!.id,
        nurseUserId: nurseUser!.id,
        amountCents: 9000,
        currency: "USD",
      }, request!),
    ).rejects.toThrow(PaymentTraceConflictError);

    expect(await db.select().from(paymentAuthorizations)).toHaveLength(1);
    expect(await db.select().from(nursePayouts)).toHaveLength(1);
  });
});
