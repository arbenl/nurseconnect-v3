import { AdminTriageRequestSchema } from "@nurseconnect/contracts";
import {
  RequestConflictError,
  RequestForbiddenError,
  RequestNotFoundError,
} from "@nurseconnect/domain-request";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/server/auth";
import { applyAdminTriageAction } from "@/server/requests/admin-triage";
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
  const context = createApiLogContext(request, "/api/admin/requests/[id]/triage", {
    action: "admin.request.triage",
  });
  let actorContext = context;
  logApiStart(context, startedAt);

  try {
    const { user: actor } = await requireRole("admin");
    actorContext = { ...context, actorId: actor.id, actorRole: actor.role };
    const { id: requestId } = await params;
    const parsed = AdminTriageRequestSchema.parse(await request.json());

    const updatedRequest = await applyAdminTriageAction({
      requestId,
      actorUserId: actor.id,
      action: parsed.action,
      reason: parsed.reason,
    });

    const response = NextResponse.json({ request: updatedRequest });
    logApiSuccess(actorContext, 200, startedAt, {
      action: "admin.request.triage",
      requestId,
      triageAction: parsed.action,
    });
    return withRequestId(response, context.requestId);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const response = NextResponse.json({ error: "Invalid payload", issues: error.issues }, { status: 400 });
      logApiFailure(actorContext, error, 400, startedAt, {
        source: "admin.request.triage",
      });
      return withRequestId(response, context.requestId);
    }

    if (error instanceof RequestForbiddenError) {
      const response = NextResponse.json({ error: error.message }, { status: 403 });
      logApiFailure(actorContext, error, 403, startedAt, {
        source: "admin.request.triage",
      });
      return withRequestId(response, context.requestId);
    }

    if (error instanceof RequestNotFoundError) {
      const response = NextResponse.json({ error: error.message }, { status: 404 });
      logApiFailure(actorContext, error, 404, startedAt, {
        source: "admin.request.triage",
      });
      return withRequestId(response, context.requestId);
    }

    if (error instanceof RequestConflictError) {
      const response = NextResponse.json({ error: error.message }, { status: 409 });
      logApiFailure(actorContext, error, 409, startedAt, {
        source: "admin.request.triage",
      });
      return withRequestId(response, context.requestId);
    }

    const err = error as { name?: string; message?: string };
    if (err.name === "UnauthorizedError") {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      logApiFailure(actorContext, "Unauthorized", 401, startedAt, {
        source: "admin.request.triage",
      });
      return withRequestId(response, context.requestId);
    }
    if (err.name === "ForbiddenError") {
      const response = NextResponse.json({ error: "Forbidden" }, { status: 403 });
      logApiFailure(actorContext, "Forbidden", 403, startedAt, {
        source: "admin.request.triage",
      });
      return withRequestId(response, context.requestId);
    }

    logApiFailure(actorContext, error, 500, startedAt, {
      source: "admin.request.triage",
    });
    return withRequestId(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }), context.requestId);
  }
}
