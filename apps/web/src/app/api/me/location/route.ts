import { NurseLocationUpdateRequestSchema } from "@nurseconnect/contracts";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCachedUser } from "@/lib/auth/user";
import {
  NurseLocationForbiddenError,
  updateMyNurseLocation,
} from "@/server/nurse-location/update-my-location";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

export async function PATCH(request: Request) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/me/location", {
    action: "me.location.update",
  });
  logApiStart(context, startedAt);

  const user = await getCachedUser();
  if (!user) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    logApiFailure(context, "Unauthorized", 401, startedAt, {
      source: "me.location",
    });
    return withRequestId(response, context.requestId);
  }

  const actorContext = { ...context, actorId: user.id, actorRole: user.role };

  try {
    const json = await request.json();
    const body = NurseLocationUpdateRequestSchema.parse(json);

    const result = await updateMyNurseLocation({
      actorUserId: user.id,
      lat: body.lat,
      lng: body.lng,
    });

    const response = NextResponse.json(result, { status: 200 });
    logApiSuccess(actorContext, 200, startedAt, {
      lat: body.lat,
      lng: body.lng,
      source: "me.location",
    });
    return withRequestId(response, context.requestId);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const response = NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 });
      logApiFailure(actorContext, error, 400, startedAt, {
        source: "me.location",
      });
      return withRequestId(response, context.requestId);
    }
    if (error instanceof NurseLocationForbiddenError) {
      const response = NextResponse.json({ error: error.message }, { status: 403 });
      logApiFailure(actorContext, error, 403, startedAt, {
        source: "me.location",
      });
      return withRequestId(response, context.requestId);
    }

    logApiFailure(actorContext, error, 500, startedAt, { source: "me.location" });
    return withRequestId(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }), context.requestId);
  }
}
