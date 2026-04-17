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

    const [patientProjection, nurseProjection] = await Promise.all([
      getPatientVisitProjection(db, {
        actorUserId: user.id,
        historyLimit: null,
      }),
      getNurseVisitProjection(db, {
        actorUserId: user.id,
        historyLimit: null,
      }),
    ]);
    const requestsById = new Map<
      string,
      | NonNullable<typeof patientProjection.activeVisit>
      | (typeof patientProjection.recentVisits)[number]
      | NonNullable<typeof nurseProjection.activeAssignment>
      | (typeof nurseProjection.recentAssignments)[number]
    >();

    for (const requestItem of [
      nurseProjection.activeAssignment,
      ...nurseProjection.recentAssignments,
      patientProjection.activeVisit,
      ...patientProjection.recentVisits,
    ]) {
      if (!requestItem) {
        continue;
      }

      requestsById.set(requestItem.id, requestItem);
    }
    const requests = [...requestsById.values()].sort(
      (left, right) =>
        Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
        right.id.localeCompare(left.id),
    );

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
