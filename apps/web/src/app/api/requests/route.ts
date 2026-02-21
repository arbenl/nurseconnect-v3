import { CreateRequestSchema } from "@nurseconnect/contracts";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCachedUser } from "@/lib/auth/user";
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

  try {
    const user = await getCachedUser();
    if (!user) {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      logApiFailure(context, "Unauthorized", 401, startedAt, { source: "requests.create" });
      return withRequestId(response, context.requestId);
    }

    const actorContext = { ...context, actorId: user.id, actorRole: user.role };
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
    if (error instanceof z.ZodError) {
      const response = NextResponse.json(error.issues, { status: 400 });
      logApiFailure(context, error, 400, startedAt, {
        source: "requests.create",
      });
      return withRequestId(response, context.requestId);
    }

    logApiFailure(context, error, 500, startedAt, {
      source: "requests.create",
    });
    return withRequestId(
      NextResponse.json("Internal Server Error", { status: 500 }),
      context.requestId,
    );
  }
}
