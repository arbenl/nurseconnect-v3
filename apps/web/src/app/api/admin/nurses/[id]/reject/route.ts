import { AdminRejectNurseSchema } from "@nurseconnect/contracts";
import { NextResponse } from "next/server";

import { rejectNurseCredential } from "@/server/admin/nurse-credentials";
import { requireRole } from "@/server/auth";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const startedAt = Date.now();
  const context = createApiLogContext(request, `/api/admin/nurses/${params.id}/reject`, {
    action: "admin.nurses.reject",
  });
  logApiStart(context, startedAt);

  let actorContext = context;

  try {
    const { user: actor } = await requireRole("admin");
    actorContext = { ...context, actorId: actor.id, actorRole: actor.role };
    const json = await request.json();
    const parsed = AdminRejectNurseSchema.safeParse(json);
    if (!parsed.success) {
      const response = NextResponse.json({ error: "Invalid data", details: parsed.error }, { status: 400 });
      logApiFailure(actorContext, parsed.error, 400, startedAt, { source: "admin.nurses.reject" });
      return withRequestId(response, context.requestId);
    }

    const { reason } = parsed.data;
    const nurse = await rejectNurseCredential({
      actorUserId: actor.id,
      nurseId: params.id,
      reason,
    });
    if (!nurse) {
      const response = NextResponse.json({ error: "Nurse not found" }, { status: 404 });
      logApiFailure(actorContext, "Nurse not found", 404, startedAt, { source: "admin.nurses.reject" });
      return withRequestId(response, context.requestId);
    }
    const response = NextResponse.json({ ok: true, status: nurse.status, nurse });
    logApiSuccess(actorContext, 200, startedAt, { source: "admin.nurses.reject" });
    return withRequestId(response, context.requestId);
  } catch (error) {
    const err = error as { name?: string };
    if (err?.name === "UnauthorizedError") {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      logApiFailure(context, "Unauthorized", 401, startedAt, { source: "admin.nurses.reject" });
      return withRequestId(response, context.requestId);
    }
    if (err?.name === "ForbiddenError") {
      const response = NextResponse.json({ error: "Forbidden" }, { status: 403 });
      logApiFailure(actorContext, "Forbidden", 403, startedAt, { source: "admin.nurses.reject" });
      return withRequestId(response, context.requestId);
    }
    logApiFailure(actorContext, error, 500, startedAt, { source: "admin.nurses.reject" });
    return withRequestId(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }), context.requestId);
  }
}
