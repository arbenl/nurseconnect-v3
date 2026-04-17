import { db } from "@nurseconnect/database";
import { getNurseVisitProjection, getPatientVisitProjection } from "@nurseconnect/domain-visit";
import { NextResponse } from "next/server";

import { authErrorResponse, requireAnyRole } from "@/server/auth";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/requests/mine", {
    action: "request.mine",
  });
  logApiStart(context, startedAt);

  let actorContext = context;
  try {
    const { user } = await requireAnyRole(["admin", "nurse", "patient"]);
    actorContext = { ...context, actorId: user.id, actorRole: user.role };

    let requests;
    if (user.role === "nurse") {
      const projection = await getNurseVisitProjection(db, {
        actorUserId: user.id,
        historyLimit: 50,
      });
      requests = [projection.activeAssignment, ...projection.recentAssignments].filter(
        (assignment): assignment is NonNullable<typeof assignment> => assignment !== null,
      );
    } else {
      const projection = await getPatientVisitProjection(db, {
        actorUserId: user.id,
        historyLimit: 50,
      });
      requests = [projection.activeVisit, ...projection.recentVisits].filter(
        (visit): visit is NonNullable<typeof visit> => visit !== null,
      );
    }
    const response = NextResponse.json(requests);
    logApiSuccess(actorContext, 200, startedAt, { count: requests.length });
    return withRequestId(response, context.requestId);
  } catch (error) {
    const authResponse = authErrorResponse(error, actorContext, startedAt, "requests.mine");
    if (authResponse) {
      return authResponse;
    }

    logApiFailure(actorContext, error, 500, startedAt, { source: "requests.mine" });
    return withRequestId(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }), context.requestId);
  }
}
