import { NextResponse } from "next/server";

import { getCachedUser } from "@/lib/auth/user";
import { getNotificationsForActor } from "@/server/requests/request-events";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/me/notifications", {
    action: "me.notifications",
  });
  logApiStart(context, startedAt);

  const user = await getCachedUser();
  if (!user) {
    const unauthorizedContext = { ...context, actorId: undefined, actorRole: undefined };
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    logApiFailure(unauthorizedContext, "Unauthorized", 401, startedAt, {
      source: "notifications",
    });
    return withRequestId(response, context.requestId);
  }

  if (user.role !== "admin" && user.role !== "nurse" && user.role !== "patient") {
    const response = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    logApiFailure(context, "Forbidden", 403, startedAt, {
      source: "notifications",
    });
    return withRequestId(response, context.requestId);
  }

  const actorContext = { ...context, actorId: user.id, actorRole: user.role };
  const query = new URL(request.url).searchParams;
  const since = query.get("since");
  const limitParam = query.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : null;

  try {
    const notifications = await getNotificationsForActor({
      actorUserId: user.id,
      actorRole: user.role,
      sinceIso: since,
      limit: Number.isFinite(limit ?? Number.NaN) ? limit : null,
    });
    const response = NextResponse.json(notifications);
    logApiSuccess(actorContext, 200, startedAt, { count: notifications.length });
    return withRequestId(response, context.requestId);
  } catch (error) {
    logApiFailure(actorContext, error, 500, startedAt, { source: "notifications" });
    return withRequestId(
      NextResponse.json({ error: "Internal Server Error" }, { status: 500 }),
      context.requestId
    );
  }
}
