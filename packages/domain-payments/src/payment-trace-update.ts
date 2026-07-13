import { UpdateNursePayoutStatusSchema, UpdatePaymentAuthorizationStatusSchema } from "@nurseconnect/contracts";
import { eq } from "drizzle-orm";

import { nursePayouts, paymentAuthorizations } from "@nurseconnect/database/schema";

import { PaymentTraceNotFoundError } from "./errors";
import { canTransitionNursePayout, canTransitionPaymentAuthorization } from "./payment-lifecycle";
import {
  type PaymentTraceDb,
  type UpdateNursePayoutTraceStatusInput,
  type UpdatePaymentAuthorizationTraceStatusInput,
  normalizeText,
} from "./payment-trace-shared";

export async function updatePaymentAuthorizationTraceStatus(
  db: PaymentTraceDb,
  input: UpdatePaymentAuthorizationTraceStatusInput,
) {
  const parsed = UpdatePaymentAuthorizationStatusSchema.parse(input);
  const current = await db.query.paymentAuthorizations.findFirst({
    where: eq(paymentAuthorizations.requestId, input.requestId),
  });
  if (!current) throw new PaymentTraceNotFoundError("Payment authorization not found");

  const nextStatus = canTransitionPaymentAuthorization(current.status, parsed.action);
  const now = new Date();
  const updateData: Partial<typeof paymentAuthorizations.$inferInsert> = {
    status: nextStatus,
    updatedAt: now,
    note: normalizeText(parsed.note) ?? current.note,
    failureReason: parsed.action === "fail" ? parsed.failureReason.trim() : current.failureReason,
  };

  if (parsed.action === "capture") {
    updateData.providerReference = normalizeText(parsed.providerReference) ?? current.providerReference;
    updateData.capturedAt = now;
  } else if (parsed.action === "void") {
    updateData.voidedAt = now;
  } else if (parsed.action === "fail") {
    updateData.failedAt = now;
  }

  const [updated] = await db.update(paymentAuthorizations)
    .set(updateData)
    .where(eq(paymentAuthorizations.id, current.id))
    .returning();
  if (!updated) throw new PaymentTraceNotFoundError("Payment authorization not found");
  return updated;
}

export async function updateNursePayoutTraceStatus(
  db: PaymentTraceDb,
  input: UpdateNursePayoutTraceStatusInput,
) {
  const parsed = UpdateNursePayoutStatusSchema.parse(input);
  const current = await db.query.nursePayouts.findFirst({
    where: eq(nursePayouts.requestId, input.requestId),
  });
  if (!current) throw new PaymentTraceNotFoundError("Nurse payout not found");

  const nextStatus = canTransitionNursePayout(current.status, parsed.action);
  const now = new Date();
  const updateData: Partial<typeof nursePayouts.$inferInsert> = {
    status: nextStatus,
    updatedAt: now,
    note: normalizeText(parsed.note) ?? current.note,
    failureReason: parsed.action === "fail" ? parsed.failureReason.trim() : current.failureReason,
  };

  if (parsed.action === "mark_paid") {
    updateData.providerReference = normalizeText(parsed.providerReference) ?? current.providerReference;
    updateData.paidAt = now;
  } else if (parsed.action === "fail") {
    updateData.failedAt = now;
  } else if (parsed.action === "cancel") {
    updateData.canceledAt = now;
  }

  const [updated] = await db.update(nursePayouts)
    .set(updateData)
    .where(eq(nursePayouts.id, current.id))
    .returning();
  if (!updated) throw new PaymentTraceNotFoundError("Nurse payout not found");
  return updated;
}
