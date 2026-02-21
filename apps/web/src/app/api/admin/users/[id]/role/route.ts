import { db, schema, eq } from "@nurseconnect/database";
import { NextResponse } from "next/server";
import { z } from "zod";

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

const roleSchema = z.object({
  role: z.enum(["admin", "nurse", "patient"]),
});

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

    let payload: z.infer<typeof roleSchema>;
    try {
      payload = roleSchema.parse(await request.json());
    } catch {
      const response = NextResponse.json({ error: "Invalid role" }, { status: 400 });
      logApiFailure(actorContext, "Invalid role", 400, startedAt, {
        targetUserId,
        source: "admin.user.role",
      });
      return withRequestId(response, context.requestId);
    }

    const { role } = payload;

    const target = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
    });
    if (!target) {
      const response = NextResponse.json({ error: "Target user not found" }, { status: 404 });
      logApiFailure(actorContext, "Target user not found", 404, startedAt, {
        targetUserId,
        source: "admin.user.role",
      });
      return withRequestId(response, context.requestId);
    }

    if (target.role === role) {
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
        .set({ role, updatedAt: new Date() })
        .where(eq(users.id, targetUserId));

      await recordAdminAction(
        {
          actorUserId: actor.id,
          action: "user.role.changed",
          targetEntityType: "user",
          targetEntityId: targetUserId,
          details: {
            previousRole: target.role,
            nextRole: role,
            targetEmail: target.email,
          },
        },
        tx,
      );
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

    logApiFailure(actorContext, err, 500, startedAt, {
      source: "admin.user.role",
    });
    return withRequestId(NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 }), context.requestId);
  }
}
