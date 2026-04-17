import { and, db, eq, or, schema } from "@nurseconnect/database";
import { ensureDomainUserFromSession } from "@nurseconnect/domain-identity";
import {
  NurseAvailabilityError,
  NurseProfileNotFoundError,
  setMyAvailability,
} from "@nurseconnect/domain-nurse";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/server/auth";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

const ACTIVE_ASSIGNMENT_STATUSES = ["assigned", "accepted", "enroute"] as const;

const nurseProfileSchema = z.object({
  isAvailable: z.boolean(),
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

    const { isAvailable } = result.data;

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

    if (isAvailable) {
      const activeAssignment = await db.query.serviceRequests.findFirst({
        where: and(
          eq(schema.serviceRequests.assignedNurseUserId, user.id),
          or(
            eq(schema.serviceRequests.status, ACTIVE_ASSIGNMENT_STATUSES[0]),
            eq(schema.serviceRequests.status, ACTIVE_ASSIGNMENT_STATUSES[1]),
            eq(schema.serviceRequests.status, ACTIVE_ASSIGNMENT_STATUSES[2]),
          ),
        ),
      });

      if (activeAssignment) {
        const response = NextResponse.json(
          { error: "Conflict: Nurse has an active visit" },
          { status: 409 },
        );
        logApiFailure(actorContext, "Conflict: Nurse has an active visit", 409, startedAt, {
          source: "me.nurse",
          requestId: activeAssignment.id,
        });
        return withRequestId(response, context.requestId);
      }
    }

    await setMyAvailability({
      actorUserId: user.id,
      isAvailable,
    });

    const response = NextResponse.json({ ok: true });
    logApiSuccess(actorContext, 200, startedAt, { source: "me.nurse" });
    return withRequestId(response, context.requestId);
  } catch (error) {
    if (error instanceof NurseProfileNotFoundError) {
      const response = NextResponse.json({ error: error.message }, { status: 404 });
      logApiFailure(actorContext, error, 404, startedAt, {
        source: "me.nurse",
      });
      return withRequestId(response, context.requestId);
    }

    if (error instanceof NurseAvailabilityError) {
      const response = NextResponse.json({ error: error.message }, { status: 403 });
      logApiFailure(actorContext, error, 403, startedAt, {
        source: "me.nurse",
      });
      return withRequestId(response, context.requestId);
    }

    logApiFailure(actorContext, error, 500, startedAt, { source: "me.nurse" });
    return withRequestId(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }), context.requestId);
  }
}
