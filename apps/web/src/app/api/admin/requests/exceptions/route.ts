import { getAdminExceptionQueue } from "@nurseconnect/domain-admin-ops";
import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/server/auth";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/admin/requests/exceptions", {
    action: "admin.request.exceptionQueue",
  });
  logApiStart(context, startedAt);

  let actorContext = context;

  try {
    const { user } = await requireRole("admin");
    actorContext = { ...context, actorId: user.id, actorRole: user.role };

    const queue = await getAdminExceptionQueue();
    const response = NextResponse.json(queue);
    logApiSuccess(actorContext, 200, startedAt, {
      action: "admin.request.exceptionQueue",
      count: queue.items.length,
    });
    return withRequestId(response, context.requestId);
  } catch (error) {
    const authResponse = authErrorResponse(error, actorContext, startedAt, "admin.requests.exceptions");
    if (authResponse) {
      return authResponse;
    }

    logApiFailure(actorContext, error, 500, startedAt, {
      source: "admin.requests.exceptions",
    });
    return withRequestId(
      NextResponse.json({ error: "Internal Server Error" }, { status: 500 }),
      context.requestId,
    );
  }
}
