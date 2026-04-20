import {
  ReferralPartnerNotFoundError,
  ReferralPartnerValidationError,
  setReferralPartnerStatus,
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/admin/referral-partners/[userId]", {
    action: "admin.referralPartners.updateStatus",
  });
  logApiStart(context, startedAt);

  let actorContext = context;

  try {
    const { user: actor } = await requireRole("admin");
    actorContext = { ...context, actorId: actor.id, actorRole: actor.role };

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      const response = NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      logApiFailure(actorContext, "Invalid payload", 400, startedAt, {
        source: "admin.referralPartners.updateStatus",
      });
      return withRequestId(response, context.requestId);
    }

    const status =
      typeof payload === "object" && payload !== null ? (payload as { status?: unknown }).status : undefined;

    if (status !== "active" && status !== "inactive") {
      const response = NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      logApiFailure(actorContext, "Invalid payload", 400, startedAt, {
        source: "admin.referralPartners.updateStatus",
      });
      return withRequestId(response, context.requestId);
    }

    const { userId } = await params;
    const profile = await setReferralPartnerStatus({ userId, status });
    const response = NextResponse.json({
      ok: true,
      profile: {
        id: profile.id,
        userId: profile.userId,
        organizationName: profile.organizationName,
        status: profile.status,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      },
    });
    logApiSuccess(actorContext, 200, startedAt, {
      source: "admin.referralPartners.updateStatus",
      targetUserId: userId,
      status,
    });
    return withRequestId(response, context.requestId);
  } catch (error) {
    const authResponse = authErrorResponse(
      error,
      actorContext,
      startedAt,
      "admin.referralPartners.updateStatus",
    );
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof ReferralPartnerValidationError) {
      const response = NextResponse.json({ error: error.message }, { status: 400 });
      logApiFailure(actorContext, error, 400, startedAt, {
        source: "admin.referralPartners.updateStatus",
      });
      return withRequestId(response, context.requestId);
    }

    if (error instanceof ReferralPartnerNotFoundError) {
      const response = NextResponse.json({ error: error.message }, { status: 404 });
      logApiFailure(actorContext, error, 404, startedAt, {
        source: "admin.referralPartners.updateStatus",
      });
      return withRequestId(response, context.requestId);
    }

    logApiFailure(actorContext, error, 500, startedAt, {
      source: "admin.referralPartners.updateStatus",
    });
    return withRequestId(
      NextResponse.json({ error: "Internal Server Error" }, { status: 500 }),
      context.requestId,
    );
  }
}
