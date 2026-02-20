import { RejectRequestSchema } from "@nurseconnect/contracts";
import { NextResponse } from "next/server";

import { getCachedUser } from "@/lib/auth/user";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";
import { requestActionErrorResponse } from "@/server/requests/request-action-http";
import { applyRequestAction } from "@/server/requests/request-actions";

type Params = { params: { id: string } };

export async function POST(request: Request, { params }: Params) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/requests/[id]/reject", {
    action: "request.reject",
  });
  logApiStart(context, startedAt);

  const user = await getCachedUser();
  if (!user) {
    const unauthorizedContext = { ...context, actorId: undefined, actorRole: undefined };
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    logApiFailure(unauthorizedContext, "Unauthorized", 401, startedAt, {
      source: "request-action",
    });
    return withRequestId(response, context.requestId);
  }

  const actorContext = { ...context, actorId: user.id, actorRole: user.role };
  try {
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
    return requestActionErrorResponse(error, actorContext, startedAt);
  }
}
