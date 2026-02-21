import { NextRequest, NextResponse } from "next/server";

import { requireRole } from "@/server/auth";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/admin/ping", {
    action: "admin.ping",
  });
  logApiStart(context, startedAt);

  try {
    const { user } = await requireRole("admin");
    const actorContext = {
      ...context,
      actorId: user.id,
      actorRole: user.role,
    };
    const response = NextResponse.json({ ok: true, user: { id: user.id, role: user.role } });
    logApiSuccess(actorContext, 200, startedAt, { source: "admin.ping" });
    return withRequestId(response, context.requestId);
  } catch (error: any) {
    if (error.name === "UnauthorizedError") {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      logApiFailure(context, "Unauthorized", 401, startedAt, {
        source: "admin.ping",
      });
      return withRequestId(response, context.requestId);
    }
    if (error.name === "ForbiddenError") {
      const response = NextResponse.json({ error: "Forbidden" }, { status: 403 });
      logApiFailure(context, "Forbidden", 403, startedAt, {
        source: "admin.ping",
      });
      return withRequestId(response, context.requestId);
    }
    const response = NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    logApiFailure(context, error, 500, startedAt, { source: "admin.ping" });
    return withRequestId(response, context.requestId);
  }
}
