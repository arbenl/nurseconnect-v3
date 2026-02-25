import { RejectRequestSchema } from "@nurseconnect/contracts";
import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/server/auth";
import { requestActionErrorResponse } from "@/server/requests/request-action-http";
import { applyRequestAction } from "@/server/requests/request-actions";
import {
  createApiLogContext,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

type Params = { params: { id: string } };

export async function POST(request: Request, { params }: Params) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/requests/[id]/reject", {
    action: "request.reject",
  });
  logApiStart(context, startedAt);

  let actorContext = context;
  try {
    const { user } = await requireRole("nurse");
    actorContext = { ...context, actorId: user.id, actorRole: user.role };

    let json: unknown = {};
    try {
      json = await request.json();
    } catch {
      json = {};
    }

    const payload = RejectRequestSchema.parse(json);
    const updated = await applyRequestAction({
      requestId: params.id,
      actorUserId: user.id,
      action: "reject",
      reason: payload.reason,
    });
    const response = NextResponse.json({ request: updated });
    logApiSuccess(actorContext, 200, startedAt, { action: "reject", requestId: params.id });
    return withRequestId(response, context.requestId);
  } catch (error) {
    const authResponse = authErrorResponse(error, actorContext, startedAt, "request-action");
    if (authResponse) {
      return authResponse;
    }

    return requestActionErrorResponse(error, actorContext, startedAt);
  }
}
