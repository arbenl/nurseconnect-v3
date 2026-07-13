import { RecordNursePayoutSchema, RecordPaymentAuthorizationSchema } from "@nurseconnect/contracts";
import { eq } from "drizzle-orm";

import { nursePayouts, paymentAuthorizations } from "@nurseconnect/database/schema";

import { PaymentTraceConflictError } from "./errors";
import {
  type PaymentTraceDb,
  type PaymentTraceRequestContext,
  type RecordNursePayoutTraceInput,
  type RecordPaymentAuthorizationTraceInput,
  normalizeText,
  requireRequestContext,
  requireRequestOrganization,
} from "./payment-trace-shared";

async function assertNoAuthorization(db: PaymentTraceDb, requestId: string) {
  const existing = await db.query.paymentAuthorizations.findFirst({
    where: eq(paymentAuthorizations.requestId, requestId),
  });
  if (existing) {
    throw new PaymentTraceConflictError("Payment authorization already exists for this request");
  }
}

async function assertNoPayout(db: PaymentTraceDb, requestId: string) {
  const existing = await db.query.nursePayouts.findFirst({
    where: eq(nursePayouts.requestId, requestId),
  });
  if (existing) throw new PaymentTraceConflictError("Nurse payout already exists for this request");
}

export async function recordPaymentAuthorizationTrace(
  db: PaymentTraceDb,
  input: RecordPaymentAuthorizationTraceInput,
  requestContext: PaymentTraceRequestContext | null,
) {
  const parsed = RecordPaymentAuthorizationSchema.parse(input);
  const request = requireRequestContext(requestContext, input.requestId);
  const organizationId = requireRequestOrganization(request);
  await assertNoAuthorization(db, input.requestId);

  const now = new Date();
  const [authorization] = await db.insert(paymentAuthorizations).values({
    requestId: input.requestId,
    organizationId,
    patientUserId: request.patientUserId,
    status: "authorized",
    amountCents: parsed.amountCents,
    currency: parsed.currency,
    provider: normalizeText(parsed.provider) ?? null,
    providerReference: normalizeText(parsed.providerReference) ?? null,
    note: normalizeText(parsed.note) ?? null,
    authorizedAt: now,
    createdAt: now,
    updatedAt: now,
  }).returning();

  if (!authorization) {
    throw new PaymentTraceConflictError("Unable to record payment authorization");
  }
  return authorization;
}

export async function recordNursePayoutTrace(
  db: PaymentTraceDb,
  input: RecordNursePayoutTraceInput,
  requestContext: PaymentTraceRequestContext | null,
) {
  const parsed = RecordNursePayoutSchema.parse(input);
  const request = requireRequestContext(requestContext, input.requestId);
  const organizationId = requireRequestOrganization(request);
  if (request.status !== "completed") {
    throw new PaymentTraceConflictError("Nurse payout can only be recorded after completion");
  }
  if (request.assignedNurseUserId && request.assignedNurseUserId !== parsed.nurseUserId) {
    throw new PaymentTraceConflictError("Payout nurse must match the completed request assignment");
  }
  await assertNoPayout(db, input.requestId);

  const now = new Date();
  const [payout] = await db.insert(nursePayouts).values({
    requestId: input.requestId,
    organizationId,
    nurseUserId: parsed.nurseUserId,
    status: "owed",
    amountCents: parsed.amountCents,
    currency: parsed.currency,
    provider: normalizeText(parsed.provider) ?? null,
    providerReference: normalizeText(parsed.providerReference) ?? null,
    note: normalizeText(parsed.note) ?? null,
    owedAt: now,
    createdAt: now,
    updatedAt: now,
  }).returning();

  if (!payout) throw new PaymentTraceConflictError("Unable to record nurse payout");
  return payout;
}
