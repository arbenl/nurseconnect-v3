import type {
  AdminRequestPaymentTrace,
  NursePayoutAction,
  PaymentAuthorizationAction,
} from "@nurseconnect/contracts";
import {
  AdminRequestPaymentTraceSchema,
  RecordNursePayoutSchema,
  RecordPaymentAuthorizationSchema,
  UpdateNursePayoutStatusSchema,
  UpdatePaymentAuthorizationStatusSchema,
} from "@nurseconnect/contracts";
import type { DbClient } from "@nurseconnect/database";
import { eq } from "drizzle-orm";

import {
  nursePayouts,
  paymentAuthorizations,
  serviceRequests,
} from "@nurseconnect/database/schema";

import {
  PaymentTraceConflictError,
  PaymentTraceNotFoundError,
} from "./errors";
import {
  canTransitionNursePayout,
  canTransitionPaymentAuthorization,
} from "./payment-lifecycle";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type PaymentTraceDb = DbClient | Transaction;

type RecordPaymentAuthorizationTraceInput = {
  requestId: string;
  actorUserId: string;
  amountCents: number;
  currency: string;
  provider?: string;
  providerReference?: string;
  note?: string;
};

type UpdatePaymentAuthorizationTraceStatusInput = {
  requestId: string;
  actorUserId: string;
  action: PaymentAuthorizationAction;
  providerReference?: string;
  failureReason?: string;
  note?: string;
};

type RecordNursePayoutTraceInput = {
  requestId: string;
  actorUserId: string;
  nurseUserId: string;
  amountCents: number;
  currency: string;
  provider?: string;
  providerReference?: string;
  note?: string;
};

type UpdateNursePayoutTraceStatusInput = {
  requestId: string;
  actorUserId: string;
  action: NursePayoutAction;
  providerReference?: string;
  failureReason?: string;
  note?: string;
};

function normalizeText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toIsoString(value: Date | string | null) {
  if (value === null) {
    return null;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid payment trace timestamp");
  }
  return parsed.toISOString();
}

function normalizeAuthorization(row: typeof paymentAuthorizations.$inferSelect) {
  return {
    ...row,
    authorizedAt: toIsoString(row.authorizedAt),
    capturedAt: toIsoString(row.capturedAt),
    voidedAt: toIsoString(row.voidedAt),
    failedAt: toIsoString(row.failedAt),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function normalizePayout(row: typeof nursePayouts.$inferSelect) {
  return {
    ...row,
    owedAt: toIsoString(row.owedAt),
    paidAt: toIsoString(row.paidAt),
    failedAt: toIsoString(row.failedAt),
    canceledAt: toIsoString(row.canceledAt),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

async function getRequestOrThrow(db: PaymentTraceDb, requestId: string) {
  const request = await db.query.serviceRequests.findFirst({
    where: eq(serviceRequests.id, requestId),
  });

  if (!request) {
    throw new PaymentTraceNotFoundError("Request not found");
  }

  return request;
}

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

  if (existing) {
    throw new PaymentTraceConflictError("Nurse payout already exists for this request");
  }
}

export async function recordPaymentAuthorizationTrace(
  db: PaymentTraceDb,
  input: RecordPaymentAuthorizationTraceInput,
) {
  const parsed = RecordPaymentAuthorizationSchema.parse({
    amountCents: input.amountCents,
    currency: input.currency,
    provider: input.provider,
    providerReference: input.providerReference,
    note: input.note,
  });
  const request = await getRequestOrThrow(db, input.requestId);
  await assertNoAuthorization(db, input.requestId);

  const now = new Date();
  const [authorization] = await db
    .insert(paymentAuthorizations)
    .values({
      requestId: input.requestId,
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
    })
    .returning();

  if (!authorization) {
    throw new PaymentTraceConflictError("Unable to record payment authorization");
  }

  return authorization;
}

export async function updatePaymentAuthorizationTraceStatus(
  db: PaymentTraceDb,
  input: UpdatePaymentAuthorizationTraceStatusInput,
) {
  const parsed = UpdatePaymentAuthorizationStatusSchema.parse(input);
  const current = await db.query.paymentAuthorizations.findFirst({
    where: eq(paymentAuthorizations.requestId, input.requestId),
  });

  if (!current) {
    throw new PaymentTraceNotFoundError("Payment authorization not found");
  }

  const nextStatus = canTransitionPaymentAuthorization(current.status, parsed.action);
  const now = new Date();
  const updateData: Partial<typeof paymentAuthorizations.$inferInsert> = {
    status: nextStatus,
    updatedAt: now,
    note: normalizeText(parsed.note) ?? current.note,
    failureReason:
      parsed.action === "fail"
        ? parsed.failureReason.trim()
        : current.failureReason,
  };

  if (parsed.action === "capture") {
    updateData.providerReference =
      normalizeText(parsed.providerReference) ?? current.providerReference;
    updateData.capturedAt = now;
  } else if (parsed.action === "void") {
    updateData.voidedAt = now;
  } else if (parsed.action === "fail") {
    updateData.failedAt = now;
  }

  const [updated] = await db
    .update(paymentAuthorizations)
    .set(updateData)
    .where(eq(paymentAuthorizations.id, current.id))
    .returning();

  if (!updated) {
    throw new PaymentTraceNotFoundError("Payment authorization not found");
  }

  return updated;
}

export async function recordNursePayoutTrace(
  db: PaymentTraceDb,
  input: RecordNursePayoutTraceInput,
) {
  const parsed = RecordNursePayoutSchema.parse({
    nurseUserId: input.nurseUserId,
    amountCents: input.amountCents,
    currency: input.currency,
    provider: input.provider,
    providerReference: input.providerReference,
    note: input.note,
  });
  const request = await getRequestOrThrow(db, input.requestId);
  if (request.status !== "completed") {
    throw new PaymentTraceConflictError("Nurse payout can only be recorded after completion");
  }
  if (request.assignedNurseUserId && request.assignedNurseUserId !== parsed.nurseUserId) {
    throw new PaymentTraceConflictError("Payout nurse must match the completed request assignment");
  }
  await assertNoPayout(db, input.requestId);

  const now = new Date();
  const [payout] = await db
    .insert(nursePayouts)
    .values({
      requestId: input.requestId,
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
    })
    .returning();

  if (!payout) {
    throw new PaymentTraceConflictError("Unable to record nurse payout");
  }

  return payout;
}

export async function updateNursePayoutTraceStatus(
  db: PaymentTraceDb,
  input: UpdateNursePayoutTraceStatusInput,
) {
  const parsed = UpdateNursePayoutStatusSchema.parse(input);
  const current = await db.query.nursePayouts.findFirst({
    where: eq(nursePayouts.requestId, input.requestId),
  });

  if (!current) {
    throw new PaymentTraceNotFoundError("Nurse payout not found");
  }

  const nextStatus = canTransitionNursePayout(current.status, parsed.action);
  const now = new Date();
  const updateData: Partial<typeof nursePayouts.$inferInsert> = {
    status: nextStatus,
    updatedAt: now,
    note: normalizeText(parsed.note) ?? current.note,
    failureReason:
      parsed.action === "fail"
        ? parsed.failureReason.trim()
        : current.failureReason,
  };

  if (parsed.action === "mark_paid") {
    updateData.providerReference =
      normalizeText(parsed.providerReference) ?? current.providerReference;
    updateData.paidAt = now;
  } else if (parsed.action === "fail") {
    updateData.failedAt = now;
  } else if (parsed.action === "cancel") {
    updateData.canceledAt = now;
  }

  const [updated] = await db
    .update(nursePayouts)
    .set(updateData)
    .where(eq(nursePayouts.id, current.id))
    .returning();

  if (!updated) {
    throw new PaymentTraceNotFoundError("Nurse payout not found");
  }

  return updated;
}

export async function getAdminRequestPaymentTrace(
  db: PaymentTraceDb,
  requestId: string,
): Promise<AdminRequestPaymentTrace> {
  await getRequestOrThrow(db, requestId);
  const [authorization, payout] = await Promise.all([
    db.query.paymentAuthorizations.findFirst({
      where: eq(paymentAuthorizations.requestId, requestId),
    }),
    db.query.nursePayouts.findFirst({
      where: eq(nursePayouts.requestId, requestId),
    }),
  ]);

  return AdminRequestPaymentTraceSchema.parse({
    requestId,
    authorization: authorization ? normalizeAuthorization(authorization) : null,
    payout: payout ? normalizePayout(payout) : null,
  });
}
