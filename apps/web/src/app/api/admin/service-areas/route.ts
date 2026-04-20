import { CreateServiceAreaSchema } from "@nurseconnect/contracts";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authErrorResponse, requireRole } from "@/server/auth";
import {
  createAdminServiceArea,
  listAdminServiceAreas,
} from "@/server/service-areas/admin-service-areas";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/admin/service-areas", {
    action: "admin.serviceAreas.list",
  });
  let actorContext = context;
  logApiStart(context, startedAt);

  try {
    const { user: actor } = await requireRole("admin");
    actorContext = { ...context, actorId: actor.id, actorRole: actor.role };

    const result = await listAdminServiceAreas();
    const response = NextResponse.json(result);
    logApiSuccess(actorContext, 200, startedAt, {
      source: "admin.serviceAreas.list",
      count: result.items.length,
    });
    return withRequestId(response, context.requestId);
  } catch (error) {
    const authResponse = authErrorResponse(error, actorContext, startedAt, "admin.serviceAreas.list");
    if (authResponse) {
      return authResponse;
    }

    logApiFailure(actorContext, error, 500, startedAt, {
      source: "admin.serviceAreas.list",
    });
    return withRequestId(
      NextResponse.json({ error: "Internal Server Error" }, { status: 500 }),
      context.requestId,
    );
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/admin/service-areas", {
    action: "admin.serviceAreas.create",
  });
  let actorContext = context;
  logApiStart(context, startedAt);

  try {
    const { user: actor } = await requireRole("admin");
    actorContext = { ...context, actorId: actor.id, actorRole: actor.role };
    const input = CreateServiceAreaSchema.parse(await request.json());

    const item = await createAdminServiceArea({
      actorUserId: actor.id,
      input,
    });
    const response = NextResponse.json({ item }, { status: 201 });
    logApiSuccess(actorContext, 201, startedAt, {
      source: "admin.serviceAreas.create",
      serviceAreaId: item.id,
    });
    return withRequestId(response, context.requestId);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const response = NextResponse.json({ error: "Invalid payload", issues: error.issues }, { status: 400 });
      logApiFailure(actorContext, error, 400, startedAt, {
        source: "admin.serviceAreas.create",
      });
      return withRequestId(response, context.requestId);
    }

    const authResponse = authErrorResponse(error, actorContext, startedAt, "admin.serviceAreas.create");
    if (authResponse) {
      return authResponse;
    }

    logApiFailure(actorContext, error, 500, startedAt, {
      source: "admin.serviceAreas.create",
    });
    return withRequestId(
      NextResponse.json({ error: "Internal Server Error" }, { status: 500 }),
      context.requestId,
    );
  }
}
