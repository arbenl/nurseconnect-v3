import type { AdminPaymentTraceMutationInput } from "@nurseconnect/contracts";
import { db } from "@nurseconnect/database";
import {
  PaymentTraceConflictError,
  PaymentTraceNotFoundError,
  getAdminRequestPaymentTrace,
  recordNursePayoutTrace,
  recordPaymentAuthorizationTrace,
  updateNursePayoutTraceStatus,
  updatePaymentAuthorizationTraceStatus,
} from "@nurseconnect/domain-payments";

import { recordAdminAction, type AdminAuditAction } from "@/server/admin/audit";

const authorizationAuditAction: Record<"capture" | "void" | "fail", AdminAuditAction> = {
  capture: "payment.authorization.captured",
  void: "payment.authorization.voided",
  fail: "payment.authorization.failed",
};

const payoutAuditAction: Record<"mark_paid" | "fail" | "cancel", AdminAuditAction> = {
  mark_paid: "payout.marked_paid",
  fail: "payout.failed",
  cancel: "payout.canceled",
};

function normalizeText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function auditDetails(
  requestId: string,
  input: AdminPaymentTraceMutationInput,
): Record<string, unknown> {
  return {
    requestId,
    kind: input.kind,
    action: input.action,
    amountCents: "amountCents" in input ? input.amountCents : undefined,
    currency: "currency" in input ? input.currency : undefined,
    provider: "provider" in input ? normalizeText(input.provider) : undefined,
    providerReference: "providerReference" in input ? normalizeText(input.providerReference) : undefined,
    nurseUserId: "nurseUserId" in input ? input.nurseUserId : undefined,
    failureReason: "failureReason" in input ? normalizeText(input.failureReason) : undefined,
  };
}

function adminAuditAction(input: AdminPaymentTraceMutationInput): AdminAuditAction {
  if (input.kind === "authorization") {
    return input.action === "record"
      ? "payment.authorization.recorded"
      : authorizationAuditAction[input.action];
  }

  return input.action === "record"
    ? "payout.recorded"
    : payoutAuditAction[input.action];
}

export async function getAdminPaymentTrace(requestId: string) {
  return getAdminRequestPaymentTrace(db, requestId);
}

export async function mutateAdminPaymentTrace(
  requestId: string,
  actorUserId: string,
  input: AdminPaymentTraceMutationInput,
) {
  await db.transaction(async (tx) => {
    if (input.kind === "authorization") {
      if (input.action === "record") {
        await recordPaymentAuthorizationTrace(tx, {
          requestId,
          actorUserId,
          amountCents: input.amountCents,
          currency: input.currency,
          provider: input.provider,
          providerReference: input.providerReference,
          note: input.note,
        });
      } else {
        await updatePaymentAuthorizationTraceStatus(tx, {
          requestId,
          actorUserId,
          action: input.action,
          providerReference:
            input.action === "capture" ? input.providerReference : undefined,
          failureReason:
            input.action === "fail" ? input.failureReason : undefined,
          note: input.note,
        });
      }
    } else if (input.action === "record") {
      await recordNursePayoutTrace(tx, {
        requestId,
        actorUserId,
        nurseUserId: input.nurseUserId,
        amountCents: input.amountCents,
        currency: input.currency,
        provider: input.provider,
        providerReference: input.providerReference,
        note: input.note,
      });
    } else {
      await updateNursePayoutTraceStatus(tx, {
        requestId,
        actorUserId,
        action: input.action,
        providerReference:
          input.action === "mark_paid" ? input.providerReference : undefined,
        failureReason:
          input.action === "fail" ? input.failureReason : undefined,
        note: input.note,
      });
    }

    await recordAdminAction(
      {
        actorUserId,
        action: adminAuditAction(input),
        targetEntityType: "request",
        targetEntityId: requestId,
        details: auditDetails(requestId, input),
      },
      tx,
    );
  });

  return getAdminPaymentTrace(requestId);
}

export { PaymentTraceConflictError, PaymentTraceNotFoundError };
