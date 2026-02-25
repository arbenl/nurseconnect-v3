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

export async function POST(_: Request, { params }: Params) {
  const startedAt = Date.now();
  const context = createApiLogContext(_, "/api/requests/[id]/cancel", {
    action: "request.cancel",
  });
  logApiStart(context, startedAt);

  let actorContext = context;
  try {
    const { user } = await requireRole("patient");
    actorContext = { ...context, actorId: user.id, actorRole: user.role };

    const updated = await applyRequestAction({
      requestId: params.id,
      actorUserId: user.id,
      action: "cancel",
    });
    const response = NextResponse.json({ request: updated });
    logApiSuccess(actorContext, 200, startedAt, { action: "cancel", requestId: params.id });
    return withRequestId(response, context.requestId);
  } catch (error) {
    const authResponse = authErrorResponse(error, actorContext, startedAt, "request-action");
    if (authResponse) {
      return authResponse;
    }

    return requestActionErrorResponse(error, actorContext, startedAt);
  }
}
