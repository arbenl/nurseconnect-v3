import { db, schema, eq } from "@nurseconnect/database";
import { buildProfileUpdatePatch, ProfileValidationError } from "@nurseconnect/domain-identity";
import { NextResponse } from "next/server";

import { assertEmailVerificationAccess, authErrorResponse, getSession } from "@/server/auth";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

const { users } = schema;

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
    await assertEmailVerificationAccess(session, "/api/me/profile");

    const body = await req.json();
    const profilePatch = buildProfileUpdatePatch(body);

    const [updatedUser] = await db
      .update(users)
      .set(profilePatch)
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
    const authResponse = authErrorResponse(error, actorContext, startedAt, "me.profile");
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof ProfileValidationError) {
      const response = NextResponse.json(
        { error: error.message, details: error.details },
        { status: 400 },
      );
      logApiFailure(actorContext, error, 400, startedAt, {
        source: "me.profile",
      });
      return withRequestId(response, context.requestId);
    }

    logApiFailure(actorContext, error, 500, startedAt, { source: "me.profile" });
    return withRequestId(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }), context.requestId);
  }
}
