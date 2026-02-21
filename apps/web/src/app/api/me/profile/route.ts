import { db, schema, eq } from "@nurseconnect/database";
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

const { users } = schema;

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().min(1, "Phone number is required"),
  city: z.string().min(1, "City is required"),
  address: z.string().optional(),
});

export async function PATCH(req: Request) {
  const startedAt = Date.now();
  const context = createApiLogContext(req, "/api/me/profile", {
    action: "me.profile.update",
  });
  logApiStart(context, startedAt);
  let actorContext = context;

  try {
    const session = await getSession();

    if (!session?.user?.id) {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      logApiFailure(context, "Unauthorized", 401, startedAt, {
        source: "me.profile",
      });
      return withRequestId(response, context.requestId);
    }

    actorContext = {
      ...context,
      actorId: session.user.id,
      actorRole: "patient",
    };

    const body = await req.json();
    const result = profileSchema.safeParse(body);

    if (!result.success) {
      const response = NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 },
      );
      logApiFailure(actorContext, result.error, 400, startedAt, {
        source: "me.profile",
      });
      return withRequestId(response, context.requestId);
    }

    const { firstName, lastName, phone, city, address } = result.data;
    const isComplete = true;

    const [updatedUser] = await db
      .update(users)
      .set({
        firstName,
        lastName,
        phone,
        city,
        address,
        profileCompletedAt: isComplete ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(users.authId, session.user.id))
      .returning();

    if (!updatedUser) {
      const response = NextResponse.json({ error: "User not found" }, { status: 404 });
      logApiFailure(actorContext, "User not found", 404, startedAt, {
        source: "me.profile",
      });
      return withRequestId(response, context.requestId);
    }

    const response = NextResponse.json({
      ok: true,
      user: {
        id: updatedUser.id,
        authId: updatedUser.authId,
        email: updatedUser.email,
        role: updatedUser.role,
        profile: {
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          phone: updatedUser.phone,
          city: updatedUser.city,
          address: updatedUser.address,
        },
        profileComplete: !!updatedUser.profileCompletedAt,
      },
    });
    logApiSuccess(actorContext, 200, startedAt, {
      targetUserId: updatedUser.id,
      source: "me.profile",
    });
    return withRequestId(response, context.requestId);
  } catch (error) {
    logApiFailure(actorContext, error, 500, startedAt, { source: "me.profile" });
    return withRequestId(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }), context.requestId);
  }
}
