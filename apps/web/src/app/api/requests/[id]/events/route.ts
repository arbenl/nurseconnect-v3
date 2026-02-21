import { NextResponse } from "next/server";

import { getCachedUser } from "@/lib/auth/user";
import {
  RequestEventForbiddenError,
  RequestEventNotFoundError,
  getRequestEventsForUser,
} from "@/server/requests/request-events";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

type Params = { params: { id: string } };

export async function GET(request: Request, { params }: Params) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/requests/[id]/events", {
    action: "request.events",
  });
  logApiStart(context, startedAt);

  const user = await getCachedUser();
  if (!user) {
    const unauthorizedContext = { ...context, actorId: undefined, actorRole: undefined };
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    logApiFailure(unauthorizedContext, "Unauthorized", 401, startedAt, {
      source: "request-events",
    });
    return withRequestId(response, context.requestId);
  }

  const actorContext = { ...context, actorId: user.id, actorRole: user.role };
  if (actorContext.actorRole !== "admin" && actorContext.actorRole !== "nurse" && actorContext.actorRole !== "patient") {
    const response = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    logApiFailure(actorContext, "Forbidden", 403, startedAt, {
      source: "request-events",
    });
    return withRequestId(response, context.requestId);
  }

  try {
    const events = await getRequestEventsForUser({
      requestId: params.id,
      actorUserId: user.id,
      actorRole: user.role,
    });
    const response = NextResponse.json(events);
    logApiSuccess(actorContext, 200, startedAt, { requestId: params.id });
    return withRequestId(response, context.requestId);
  } catch (error) {
    if (error instanceof RequestEventNotFoundError) {
      const response = NextResponse.json({ error: (error as Error).message }, { status: 404 });
      logApiFailure(actorContext, error, 404, startedAt, { source: "request-events" });
      return withRequestId(response, context.requestId);
    }
    if (error instanceof RequestEventForbiddenError) {
      const response = NextResponse.json({ error: (error as Error).message }, { status: 403 });
      logApiFailure(actorContext, error, 403, startedAt, { source: "request-events" });
      return withRequestId(response, context.requestId);
    }

    logApiFailure(actorContext, error, 500, startedAt, { source: "request-events" });
    return withRequestId(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }), context.requestId);
  }
}
