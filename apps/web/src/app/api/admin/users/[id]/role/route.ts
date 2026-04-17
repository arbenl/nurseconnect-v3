import { db, schema, eq } from "@nurseconnect/database";
import {
  planUserRoleChange,
  RoleChangeValidationError,
  UserNotFoundError,
} from "@nurseconnect/domain-identity";
import { NextResponse } from "next/server";

import { recordAdminAction } from "@/server/admin/audit";
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
    const payload = await request.json();
    const nextRole = typeof payload === "object" && payload !== null ? (payload as { role?: unknown }).role : undefined;

    const target = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
    });
    if (!target) {
      throw new UserNotFoundError("Target user not found");
    }

    const planned = planUserRoleChange({
      targetUser: target,
      nextRole,
    });

    if (planned.unchanged) {
      const response = NextResponse.json({ ok: true, unchanged: true });
      logApiSuccess(actorContext, 200, startedAt, {
        source: "admin.user.role",
        targetUserId,
        unchanged: true,
      });
      return withRequestId(response, context.requestId);
    }

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set(planned.patch)
        .where(eq(users.id, targetUserId));

      for (const sideEffect of planned.sideEffects) {
        if (sideEffect.type === "admin-audit") {
          await recordAdminAction(
            {
              actorUserId: actor.id,
              action: sideEffect.action,
              targetEntityType: "user",
              targetEntityId: sideEffect.targetUserId,
              details: sideEffect.details,
            },
            tx,
          );
        }
      }
    });

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
    if (err.name === "RoleChangeValidationError") {
      const response = NextResponse.json({ error: err.message || "Invalid role" }, { status: 400 });
      logApiFailure(actorContext, err.message || "Invalid role", 400, startedAt, {
        source: "admin.user.role",
      });
      return withRequestId(response, context.requestId);
    }
    if (err.name === "UserNotFoundError") {
      const response = NextResponse.json({ error: err.message || "Target user not found" }, { status: 404 });
      logApiFailure(actorContext, err.message || "Target user not found", 404, startedAt, {
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
