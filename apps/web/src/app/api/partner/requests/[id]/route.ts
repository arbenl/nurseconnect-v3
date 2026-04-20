import { db } from "@nurseconnect/database";
import {
  getPartnerRequestDetail,
  ReferralPartnerInactiveError,
  ReferralPartnerNotFoundError,
  ReferralPartnerValidationError,
} from "@nurseconnect/domain-referral";
import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/server/auth";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/partner/requests/[id]", {
    action: "partner.requests.detail",
  });
  logApiStart(context, startedAt);

  let actorContext = context;

  try {
    const { user } = await requireRole("referral_partner");
    actorContext = { ...context, actorId: user.id, actorRole: user.role };

    const { id } = await params;
    const detail = await getPartnerRequestDetail(db, {
      actorUserId: user.id,
      requestId: id,
    });

    const response = NextResponse.json(detail);
    logApiSuccess(actorContext, 200, startedAt, {
      source: "partner.requests.detail",
      requestId: id,
    });
    return withRequestId(response, context.requestId);
  } catch (error) {
    const authResponse = authErrorResponse(error, actorContext, startedAt, "partner.requests.detail");
    if (authResponse) {
      return authResponse;
    }

    if (
      error instanceof ReferralPartnerValidationError ||
      error instanceof ReferralPartnerInactiveError
    ) {
      const response = NextResponse.json({ error: (error as Error).message }, { status: 400 });
      logApiFailure(actorContext, error, 400, startedAt, { source: "partner.requests.detail" });
      return withRequestId(response, context.requestId);
    }

    if (error instanceof ReferralPartnerNotFoundError) {
      const response = NextResponse.json({ error: error.message }, { status: 404 });
      logApiFailure(actorContext, error, 404, startedAt, { source: "partner.requests.detail" });
      return withRequestId(response, context.requestId);
    }

    logApiFailure(actorContext, error, 500, startedAt, { source: "partner.requests.detail" });
    return withRequestId(
      NextResponse.json({ error: "Internal Server Error" }, { status: 500 }),
      context.requestId,
    );
  }
}
