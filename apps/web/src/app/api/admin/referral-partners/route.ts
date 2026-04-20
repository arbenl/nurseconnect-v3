import {
  createReferralPartnerProfile,
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

export async function POST(request: Request) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/admin/referral-partners", {
    action: "admin.referralPartners.create",
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
        source: "admin.referralPartners.create",
      });
      return withRequestId(response, context.requestId);
    }

    const userId =
      typeof payload === "object" && payload !== null ? (payload as { userId?: unknown }).userId : undefined;
    const organizationName =
      typeof payload === "object" && payload !== null
        ? (payload as { organizationName?: unknown }).organizationName
        : undefined;

    if (typeof userId !== "string" || typeof organizationName !== "string") {
      const response = NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      logApiFailure(actorContext, "Invalid payload", 400, startedAt, {
        source: "admin.referralPartners.create",
      });
      return withRequestId(response, context.requestId);
    }

    const profile = await createReferralPartnerProfile({ userId, organizationName });
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
      source: "admin.referralPartners.create",
      targetUserId: userId,
    });
    return withRequestId(response, context.requestId);
  } catch (error) {
    const authResponse = authErrorResponse(
      error,
      actorContext,
      startedAt,
      "admin.referralPartners.create",
    );
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof ReferralPartnerValidationError) {
      const response = NextResponse.json({ error: error.message }, { status: 400 });
      logApiFailure(actorContext, error, 400, startedAt, {
        source: "admin.referralPartners.create",
      });
      return withRequestId(response, context.requestId);
    }

    logApiFailure(actorContext, error, 500, startedAt, {
      source: "admin.referralPartners.create",
    });
    return withRequestId(
      NextResponse.json({ error: "Internal Server Error" }, { status: 500 }),
      context.requestId,
    );
  }
}
