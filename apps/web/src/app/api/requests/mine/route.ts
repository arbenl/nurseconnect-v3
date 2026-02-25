import { db, eq, or, schema, desc } from "@nurseconnect/database";
import { NextResponse } from "next/server";

import { authErrorResponse, requireAnyRole } from "@/server/auth";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

const { serviceRequests } = schema;

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

    const requests = await db
      .select()
      .from(serviceRequests)
      .where(
        or(eq(serviceRequests.patientUserId, user.id), eq(serviceRequests.assignedNurseUserId, user.id)),
      )
      .orderBy(desc(serviceRequests.createdAt));
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
