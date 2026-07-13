import type { NursePayoutAction, PaymentAuthorizationAction } from "@nurseconnect/contracts";
import type { DbClient } from "@nurseconnect/database";
import { nursePayouts, paymentAuthorizations } from "@nurseconnect/database/schema";

import { PaymentTraceConflictError, PaymentTraceNotFoundError } from "./errors";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
export type PaymentTraceDb = DbClient | Transaction;

export type PaymentTraceRequestContext = {
  id: string;
  organizationId: string | null;
  patientUserId: string;
  assignedNurseUserId: string | null;
  status: string;
};

export type RecordPaymentAuthorizationTraceInput = {
  requestId: string;
  amountCents: number;
  currency: string;
  provider?: string;
  providerReference?: string;
  note?: string;
};

export type UpdatePaymentAuthorizationTraceStatusInput = {
  requestId: string;
  action: PaymentAuthorizationAction;
  providerReference?: string;
  failureReason?: string;
  note?: string;
};

export type RecordNursePayoutTraceInput = {
  requestId: string;
  nurseUserId: string;
  amountCents: number;
  currency: string;
  provider?: string;
  providerReference?: string;
  note?: string;
};

export type UpdateNursePayoutTraceStatusInput = {
  requestId: string;
  action: NursePayoutAction;
  providerReference?: string;
  failureReason?: string;
  note?: string;
};

export function requireRequestContext(
  request: PaymentTraceRequestContext | null,
  requestId: string,
) {
  if (!request || request.id !== requestId) {
    throw new PaymentTraceNotFoundError("Request not found");
  }
  return request;
}

export function requireRequestOrganization(request: PaymentTraceRequestContext) {
  if (!request.organizationId) {
    throw new PaymentTraceConflictError("Payment trace requires tenant-owned request");
  }
  return request.organizationId;
}

export function normalizeText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toIsoString(value: Date | string | null) {
  if (value === null) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid payment trace timestamp");
  return parsed.toISOString();
}

export function normalizeAuthorization(row: typeof paymentAuthorizations.$inferSelect) {
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

export function normalizePayout(row: typeof nursePayouts.$inferSelect) {
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
