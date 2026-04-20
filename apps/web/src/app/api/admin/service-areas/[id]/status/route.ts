import { ServiceAreaStatusChangeSchema } from "@nurseconnect/contracts";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authErrorResponse, requireRole } from "@/server/auth";
import {
  ServiceAreaNotFoundError,
  setAdminServiceAreaStatus,
} from "@/server/service-areas/admin-service-areas";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/admin/service-areas/[id]/status", {
    action: "admin.serviceAreas.status",
  });
  let actorContext = context;
  logApiStart(context, startedAt);

  try {
    const { user: actor } = await requireRole("admin");
    actorContext = { ...context, actorId: actor.id, actorRole: actor.role };
    const { id } = await params;
    const input = ServiceAreaStatusChangeSchema.parse(await request.json());

    const item = await setAdminServiceAreaStatus({
      actorUserId: actor.id,
      id,
      status: input.status,
    });
    const response = NextResponse.json({ item });
    logApiSuccess(actorContext, 200, startedAt, {
      source: "admin.serviceAreas.status",
      serviceAreaId: item.id,
      status: item.status,
    });
    return withRequestId(response, context.requestId);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const response = NextResponse.json({ error: "Invalid payload", issues: error.issues }, { status: 400 });
      logApiFailure(actorContext, error, 400, startedAt, {
        source: "admin.serviceAreas.status",
      });
      return withRequestId(response, context.requestId);
    }

    if (error instanceof ServiceAreaNotFoundError) {
      const response = NextResponse.json({ error: error.message }, { status: 404 });
      logApiFailure(actorContext, error, 404, startedAt, {
        source: "admin.serviceAreas.status",
      });
      return withRequestId(response, context.requestId);
    }

    const authResponse = authErrorResponse(error, actorContext, startedAt, "admin.serviceAreas.status");
    if (authResponse) {
      return authResponse;
    }

    logApiFailure(actorContext, error, 500, startedAt, {
      source: "admin.serviceAreas.status",
    });
    return withRequestId(
      NextResponse.json({ error: "Internal Server Error" }, { status: 500 }),
      context.requestId,
    );
  }
}
