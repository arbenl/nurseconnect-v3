import type {
  NursePayoutAction,
  NursePayoutStatus,
  PaymentAuthorizationAction,
  PaymentAuthorizationStatus,
} from "@nurseconnect/contracts";

import { PaymentTraceConflictError } from "./errors";

const authorizationTransitionMap: Record<
  PaymentAuthorizationAction,
  Partial<Record<PaymentAuthorizationStatus, PaymentAuthorizationStatus>>
> = {
  capture: {
    authorized: "captured",
  },
  void: {
    authorized: "voided",
  },
  fail: {
    authorized: "failed",
  },
};

const payoutTransitionMap: Record<
  NursePayoutAction,
  Partial<Record<NursePayoutStatus, NursePayoutStatus>>
> = {
  mark_paid: {
    owed: "paid",
  },
  fail: {
    owed: "failed",
  },
  cancel: {
    owed: "canceled",
  },
};

export function canTransitionPaymentAuthorization(
  from: PaymentAuthorizationStatus,
  action: PaymentAuthorizationAction,
): PaymentAuthorizationStatus {
  const next = authorizationTransitionMap[action]?.[from];
  if (!next) {
    throw new PaymentTraceConflictError(
      `Invalid payment authorization transition: ${from} -> ${action}`,
    );
  }
  return next;
}

export function canTransitionNursePayout(
  from: NursePayoutStatus,
  action: NursePayoutAction,
): NursePayoutStatus {
  const next = payoutTransitionMap[action]?.[from];
  if (!next) {
    throw new PaymentTraceConflictError(
      `Invalid nurse payout transition: ${from} -> ${action}`,
    );
  }
  return next;
}
