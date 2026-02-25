
import { db, eq, schema } from "@nurseconnect/database";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureDomainUserFromSession } from "@/lib/user-service";
import { getSession } from "@/server/auth";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

const becomeNurseSchema = z.object({
  licenseNumber: z.string().min(1, "License number is required"),
  specialization: z.string().min(1, "Specialization is required"),
});

export async function POST(request: Request) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/me/become-nurse", {
    action: "me.becomeNurse",
  });
  logApiStart(context, startedAt);

  const session = await getSession();
  if (!session?.user?.id) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    logApiFailure(context, "Unauthorized", 401, startedAt, { source: "me.becomeNurse" });
    return withRequestId(response, context.requestId);
  }

  const actorContext = {
    ...context,
    actorId: session.user.id,
  };

  try {
    const json = await request.json();
    const result = becomeNurseSchema.safeParse(json);

    if (!result.success) {
      const response = NextResponse.json(
        { error: "Invalid data", details: result.error },
        { status: 400 },
      );
      logApiFailure(actorContext, result.error, 400, startedAt, {
        source: "me.becomeNurse",
      });
      return withRequestId(response, context.requestId);
    }

    const { licenseNumber, specialization } = result.data;

    const user = await ensureDomainUserFromSession({
      id: session.user.id,
      email: session.user.email!,
    });

    if (!user) {
      const response = NextResponse.json({ error: "User not found" }, { status: 404 });
      logApiFailure(actorContext, "User not found", 404, startedAt, {
        source: "me.becomeNurse",
      });
      return withRequestId(response, context.requestId);
    }

    // Transaction to update role and upsert nurse record (idempotent)
    const actorContextWithRole = {
      ...actorContext,
      actorRole: user.role,
    };

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(schema.users)
        .set({ role: "nurse", updatedAt: now })
        .where(eq(schema.users.id, user.id));

      await tx
        .insert(schema.nurses)
        .values({
          userId: user.id,
          status: "pending", // Default to pending verification
          licenseNumber,
          specialization,
          isAvailable: false,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.nurses.userId,
          set: {
            status: "pending",
            licenseNumber,
            specialization,
            updatedAt: now,
          },
        });
    });

    const response = NextResponse.json({ ok: true });
    logApiSuccess(actorContextWithRole, 200, startedAt, {
      source: "me.becomeNurse",
      targetUserId: user.id,
    });
    return withRequestId(response, context.requestId);
  } catch (error) {
    logApiFailure(actorContext, error, 500, startedAt, {
      source: "me.becomeNurse",
    });
    return withRequestId(
      NextResponse.json({ error: "Internal Server Error" }, { status: 500 }),
      context.requestId,
    );
  }
}
