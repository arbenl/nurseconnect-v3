import { db, desc, eq, schema } from "@nurseconnect/database";
import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/server/auth";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

const { serviceRequests } = schema;

const ACTIVE_ASSIGNMENT_STATUSES = new Set(["assigned", "accepted", "enroute"]);

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

    const assignments = await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.assignedNurseUserId, user.id))
      .orderBy(desc(serviceRequests.createdAt));

    const activeAssignment =
      assignments.find((requestRow) => ACTIVE_ASSIGNMENT_STATUSES.has(requestRow.status)) ?? null;
    const recentAssignments = assignments
      .filter((requestRow) => requestRow.id !== activeAssignment?.id)
      .slice(0, 5);

    const response = NextResponse.json({
      activeAssignment,
      recentAssignments,
    });
    logApiSuccess(actorContext, 200, startedAt, {
      activeAssignmentId: activeAssignment?.id ?? null,
      count: assignments.length,
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
