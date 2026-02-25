import { CreateRequestSchema } from "@nurseconnect/contracts";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authErrorResponse, requireRole } from "@/server/auth";
import { createAndAssignRequest } from "@/server/requests/allocate-request";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/requests", {
    action: "request.create",
  });
  logApiStart(context, startedAt);

  let actorContext = context;

  try {
    const { user } = await requireRole("patient");
    actorContext = { ...context, actorId: user.id, actorRole: user.role };

    const json = await request.json();
    const body = CreateRequestSchema.parse(json);
    const newRequest = await createAndAssignRequest({
      patientUserId: user.id,
      address: body.address,
      lat: body.lat,
      lng: body.lng,
    });

    const response = NextResponse.json(newRequest);
    logApiSuccess(actorContext, 200, startedAt, { action: "request.create", requestId: newRequest.id });
    return withRequestId(response, context.requestId);
  } catch (error) {
    const authResponse = authErrorResponse(error, actorContext, startedAt, "requests.create");
    if (authResponse) {
      return authResponse;
    }
    if (error instanceof z.ZodError) {
      const response = NextResponse.json(error.issues, { status: 400 });
      logApiFailure(actorContext, error, 400, startedAt, {
        source: "requests.create",
      });
      return withRequestId(response, context.requestId);
    }

    logApiFailure(actorContext, error, 500, startedAt, {
      source: "requests.create",
    });
    return withRequestId(
      NextResponse.json("Internal Server Error", { status: 500 }),
      context.requestId,
    );
  }
}
