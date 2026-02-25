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

const nurseProfileSchema = z.object({
  licenseNumber: z.string().min(1, "License number is required").optional(),
  specialization: z.string().min(1, "Specialization is required").optional(),
  isAvailable: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/me/nurse", {
    action: "me.nurse.update",
  });
  logApiStart(context, startedAt);

  const session = await getSession();
  if (!session?.user?.id) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    logApiFailure(context, "Unauthorized", 401, startedAt, { source: "me.nurse" });
    return withRequestId(response, context.requestId);
  }

  const actorContext = { ...context, actorId: session.user.id };

  try {
    const json = await request.json();
    const result = nurseProfileSchema.safeParse(json);

    if (!result.success) {
      const response = NextResponse.json({ error: "Invalid data", details: result.error }, { status: 400 });
      logApiFailure(actorContext, result.error, 400, startedAt, {
        source: "me.nurse",
      });
      return withRequestId(response, context.requestId);
    }

    const { licenseNumber, specialization, isAvailable } = result.data;

    const user = await ensureDomainUserFromSession({
      id: session.user.id,
      email: session.user.email!,
    });

    if (!user || user.role !== "nurse") {
      const response = NextResponse.json({ error: "Forbidden: User is not a nurse" }, { status: 403 });
      logApiFailure(actorContext, "Forbidden: User is not a nurse", 403, startedAt, {
        source: "me.nurse",
      });
      return withRequestId(response, context.requestId);
    }

    const existingNurse = await db.query.nurses.findFirst({
      where: eq(schema.nurses.userId, user.id),
    });

    const now = new Date();
    if (existingNurse) {
      await db
        .update(schema.nurses)
        .set({
          ...(licenseNumber ? { licenseNumber } : {}),
          ...(specialization ? { specialization } : {}),
          isAvailable: isAvailable ?? existingNurse.isAvailable,
          updatedAt: now,
        })
        .where(eq(schema.nurses.userId, user.id));
    } else {
      if (!licenseNumber || !specialization) {
        const response = NextResponse.json({ error: "License number and specialization are required for initial profile." }, { status: 400 });
        logApiFailure(actorContext, "License number and specialization are required for initial profile.", 400, startedAt, {
          source: "me.nurse",
        });
        return withRequestId(response, context.requestId);
      }

      await db
        .insert(schema.nurses)
        .values({
          userId: user.id,
          status: "pending",
          licenseNumber,
          specialization,
          isAvailable: isAvailable ?? false,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.nurses.userId,
          set: {
            licenseNumber,
            specialization,
            isAvailable: isAvailable ?? false,
            updatedAt: now,
          },
        });
    }

    const response = NextResponse.json({ ok: true });
    logApiSuccess(actorContext, 200, startedAt, { source: "me.nurse" });
    return withRequestId(response, context.requestId);
  } catch (error) {
    logApiFailure(actorContext, error, 500, startedAt, { source: "me.nurse" });
    return withRequestId(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }), context.requestId);
  }
}
