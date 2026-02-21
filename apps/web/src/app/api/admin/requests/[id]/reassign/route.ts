import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/server/auth";
import { recordAdminAction } from "@/server/admin/audit";
import { reassignRequest } from "@/server/requests/admin-reassign";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";
import {
  RequestNotFoundError,
  RequestReassignForbiddenError,
  RequestReassignValidationError,
} from "@/server/requests/admin-reassign";

const reassignSchema = z.object({
  nurseUserId: z.string().uuid().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/admin/requests/[id]/reassign", {
    action: "admin.request.reassign",
  });
  logApiStart(context, startedAt);

  try {
    const { user: actor } = await requireRole("admin");
    const actorContext = { ...context, actorId: actor.id, actorRole: actor.role };
    const { id: requestId } = await params;
    const parsed = reassignSchema.parse(await request.json());

    const { request: updatedRequest, previousNurseUserId } = await reassignRequest({
      requestId,
      actorUserId: actor.id,
      nurseUserId: parsed.nurseUserId,
    });

    await recordAdminAction({
      actorUserId: actor.id,
      action: "request.reassigned",
      targetEntityType: "request",
      targetEntityId: requestId,
      details: {
        requestId,
        nurseUserId: parsed.nurseUserId,
        previousNurseUserId,
      },
    });

    const response = NextResponse.json({ request: updatedRequest });
    logApiSuccess(actorContext, 200, startedAt, {
      action: "admin.request.reassign",
      requestId,
      nurseUserId: parsed.nurseUserId,
    });
    return withRequestId(response, context.requestId);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const response = NextResponse.json({ error: "Invalid payload", issues: error.issues }, { status: 400 });
      logApiFailure(context, error, 400, startedAt, {
        source: "admin.request.reassign",
      });
      return withRequestId(response, context.requestId);
    }

    if (error instanceof RequestReassignValidationError) {
      const response = NextResponse.json({ error: error.message }, { status: 400 });
      logApiFailure(context, error, 400, startedAt, {
        source: "admin.request.reassign",
      });
      return withRequestId(response, context.requestId);
    }

    if (error instanceof RequestReassignForbiddenError) {
      const response = NextResponse.json({ error: error.message }, { status: 403 });
      logApiFailure(context, error, 403, startedAt, {
        source: "admin.request.reassign",
      });
      return withRequestId(response, context.requestId);
    }

    if (error instanceof RequestNotFoundError) {
      const response = NextResponse.json({ error: error.message }, { status: 404 });
      logApiFailure(context, error, 404, startedAt, {
        source: "admin.request.reassign",
      });
      return withRequestId(response, context.requestId);
    }

    const err = error as { name?: string; message?: string };
    if (err.name === "UnauthorizedError") {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      logApiFailure(context, "Unauthorized", 401, startedAt, {
        source: "admin.request.reassign",
      });
      return withRequestId(response, context.requestId);
    }
    if (err.name === "ForbiddenError") {
      const response = NextResponse.json({ error: "Forbidden" }, { status: 403 });
      logApiFailure(context, "Forbidden", 403, startedAt, {
        source: "admin.request.reassign",
      });
      return withRequestId(response, context.requestId);
    }

    logApiFailure(context, error, 500, startedAt, {
      source: "admin.request.reassign",
    });
    return withRequestId(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }), context.requestId);
  }
}
