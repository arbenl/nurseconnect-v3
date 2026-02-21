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

const { nurses, users } = schema;

const availabilitySchema = z.object({
  isAvailable: z.boolean(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/admin/nurses/[id]/availability", {
    action: "admin.nurse.availability",
  });
  logApiStart(context, startedAt);

  try {
    const { user: actor } = await requireRole("admin");
    const actorContext = { ...context, actorId: actor.id, actorRole: actor.role };
    const { id: targetUserId } = await params;

    const parsed = availabilitySchema.parse(await request.json());

    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
    });

    if (!targetUser || targetUser.role !== "nurse") {
      const response = NextResponse.json({ error: "Target user is not a nurse" }, { status: 404 });
      logApiFailure(actorContext, "Target user is not a nurse", 404, startedAt, {
        source: "admin.nurse.availability",
        targetUserId,
      });
      return withRequestId(response, context.requestId);
    }

    const nurseProfile = await db.query.nurses.findFirst({
      where: eq(nurses.userId, targetUserId),
    });

    if (!nurseProfile) {
      const response = NextResponse.json({ error: "Nurse profile not found" }, { status: 404 });
      logApiFailure(actorContext, "Nurse profile not found", 404, startedAt, {
        source: "admin.nurse.availability",
        targetUserId,
      });
      return withRequestId(response, context.requestId);
    }

    await db
      .update(nurses)
      .set({ isAvailable: parsed.isAvailable, updatedAt: new Date() })
      .where(eq(nurses.userId, targetUserId));

    await recordAdminAction({
      actorUserId: actor.id,
      action: "nurse.availability.overridden",
      targetEntityType: "user",
      targetEntityId: targetUserId,
      details: {
        nurseUserId: targetUserId,
        previousIsAvailable: nurseProfile.isAvailable,
        nextIsAvailable: parsed.isAvailable,
      },
    });

    const response = NextResponse.json({ ok: true });
    logApiSuccess(actorContext, 200, startedAt, {
      source: "admin.nurse.availability",
      targetUserId,
      isAvailable: parsed.isAvailable,
    });
    return withRequestId(response, context.requestId);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const response = NextResponse.json({ error: "Invalid payload", issues: error.issues }, { status: 400 });
      logApiFailure(context, error, 400, startedAt, { source: "admin.nurse.availability" });
      return withRequestId(response, context.requestId);
    }

    const err = error as { name?: string; message?: string };
    if (err.name === "UnauthorizedError") {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      logApiFailure(context, "Unauthorized", 401, startedAt, {
        source: "admin.nurse.availability",
      });
      return withRequestId(response, context.requestId);
    }
    if (err.name === "ForbiddenError") {
      const response = NextResponse.json({ error: "Forbidden" }, { status: 403 });
      logApiFailure(context, "Forbidden", 403, startedAt, {
        source: "admin.nurse.availability",
      });
      return withRequestId(response, context.requestId);
    }

    logApiFailure(context, error, 500, startedAt, { source: "admin.nurse.availability" });
    return withRequestId(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }), context.requestId);
  }
}
