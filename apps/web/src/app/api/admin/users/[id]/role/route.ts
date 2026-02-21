import { db, schema, eq } from "@nurseconnect/database";
import { NextResponse } from "next/server";

import { requireRole } from "@/server/auth";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

const { users } = schema;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/admin/users/[id]/role", {
    action: "admin.user.role.update",
  });
  logApiStart(context, startedAt);
  let actorContext = context;

  try {
    // 1. Enforce RBAC
    const { user: actor } = await requireRole("admin");
    actorContext = {
      ...context,
      actorId: actor.id,
      actorRole: actor.role,
    };

    const { id: targetUserId } = await params;

    // 2. Parse Body
    const body = await request.json();
    const { role } = body;

    // 3. Validation
    if (!["admin", "nurse", "patient"].includes(role)) {
      const response = NextResponse.json({ error: "Invalid role" }, { status: 400 });
      logApiFailure(actorContext, "Invalid role", 400, startedAt, {
        targetUserId,
        source: "admin.user.role",
      });
      return withRequestId(response, context.requestId);
    }

    // 4. Update DB
    await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, targetUserId));

    const response = NextResponse.json({ ok: true });
    logApiSuccess(actorContext, 200, startedAt, {
      source: "admin.user.role",
      targetUserId,
    });
    return withRequestId(response, context.requestId);
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "UnauthorizedError") {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      logApiFailure(actorContext, "Unauthorized", 401, startedAt, {
        source: "admin.user.role",
      });
      return withRequestId(response, context.requestId);
    }
    if (err.name === "ForbiddenError") {
      const response = NextResponse.json({ error: "Forbidden" }, { status: 403 });
      logApiFailure(actorContext, "Forbidden", 403, startedAt, {
        source: "admin.user.role",
      });
      return withRequestId(response, context.requestId);
    }

    logApiFailure(actorContext, err, 500, startedAt, {
      source: "admin.user.role",
    });
    return withRequestId(NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 }), context.requestId);
  }
}
