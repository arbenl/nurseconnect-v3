import type { AdminRequestPaymentTrace } from "@nurseconnect/contracts";
import { AdminRequestPaymentTraceSchema } from "@nurseconnect/contracts";
import { eq } from "drizzle-orm";

import { nursePayouts, paymentAuthorizations } from "@nurseconnect/database/schema";

import {
  type PaymentTraceDb,
  type PaymentTraceRequestContext,
  normalizeAuthorization,
  normalizePayout,
  requireRequestContext,
} from "./payment-trace-shared";

export async function getAdminRequestPaymentTrace(
  db: PaymentTraceDb,
  requestId: string,
  requestContext: PaymentTraceRequestContext | null,
): Promise<AdminRequestPaymentTrace> {
  requireRequestContext(requestContext, requestId);
  const [authorization, payout] = await Promise.all([
    db.query.paymentAuthorizations.findFirst({
      where: eq(paymentAuthorizations.requestId, requestId),
    }),
    db.query.nursePayouts.findFirst({ where: eq(nursePayouts.requestId, requestId) }),
  ]);

  return AdminRequestPaymentTraceSchema.parse({
    requestId,
    authorization: authorization ? normalizeAuthorization(authorization) : null,
    payout: payout ? normalizePayout(payout) : null,
  });
}
