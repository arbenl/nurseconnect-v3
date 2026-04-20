import { db } from "@nurseconnect/database";
import { getNurseVisitProjection } from "@nurseconnect/domain-visit";
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
  const context = createApiLogContext(request, "/api/requests/assigned", {
    action: "request.assigned.mine",
  });
  logApiStart(context, startedAt);

  let actorContext = context;
  try {
    const { user } = await requireRole("nurse");
    actorContext = { ...context, actorId: user.id, actorRole: user.role };

    const projection = await getNurseVisitProjection(db, {
      actorUserId: user.id,
      historyLimit: 5,
    });

    const response = NextResponse.json({
      activeAssignment: projection.activeAssignment,
      recentAssignments: projection.recentAssignments,
    });
    logApiSuccess(actorContext, 200, startedAt, {
      activeAssignmentId: projection.activeAssignment?.id ?? null,
      count:
        projection.recentAssignments.length + (projection.activeAssignment ? 1 : 0),
    });
    return withRequestId(response, context.requestId);
  } catch (error) {
    const authResponse = authErrorResponse(error, actorContext, startedAt, "requests.assigned.mine");
    if (authResponse) {
      return authResponse;
    }

    logApiFailure(actorContext, error, 500, startedAt, { source: "requests.assigned.mine" });
    return withRequestId(
      NextResponse.json({ error: "Internal Server Error" }, { status: 500 }),
      context.requestId,
    );
  }
}
