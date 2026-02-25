import { NextResponse } from "next/server";

import {
  ensureDomainUserFromSession,
  maybeBootstrapFirstAdmin,
  getNurseByUserId,
} from "@/lib/user-service";
import { getSession } from "@/server/auth";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/me", {
    action: "me.profile.fetch",
  });
  logApiStart(context, startedAt);
  let actorContext = context;

  try {
    const session = await getSession();

    if (!session?.user?.id || !session?.user?.email) {
      const response = NextResponse.json({ ok: true, user: null }, { status: 200 });
      logApiSuccess(context, 200, startedAt, { statusMessage: "unauthenticated" });
      return withRequestId(response, context.requestId);
    }

    actorContext = { ...context, actorId: session.user.id };

    const domainUser = await ensureDomainUserFromSession({
      id: session.user.id,
      email: session.user.email!,
      name: session.user.name,
      image: session.user.image,
    });

    if (!domainUser) {
      throw new Error("Failed to upsert domain user");
    }

    const bootstrappedUser = await maybeBootstrapFirstAdmin(domainUser);
    const finalUser = bootstrappedUser ?? domainUser;

    const profile = {
      firstName: finalUser.firstName,
      lastName: finalUser.lastName,
      phone: finalUser.phone,
      city: finalUser.city,
      address: finalUser.address,
    };

    let nurseProfile = null;
    if (finalUser.role === "nurse") {
      const nurse = await getNurseByUserId(finalUser.id);
      if (nurse) {
        nurseProfile = {
          licenseNumber: nurse.licenseNumber,
          specialization: nurse.specialization,
          isAvailable: nurse.isAvailable,
        };
      }
    }

    const isPatientComplete = !!(
      finalUser.firstName &&
      finalUser.lastName &&
      finalUser.phone &&
      finalUser.city
    );

    let isNurseComplete = true;
    if (finalUser.role === "nurse") {
      isNurseComplete = !!(
        nurseProfile?.licenseNumber &&
        nurseProfile?.specialization
      );
    }

    const isComplete = isPatientComplete && isNurseComplete;

    const response = NextResponse.json(
      {
        ok: true,
        session,
        user: {
          id: finalUser.id,
          authId: finalUser.authId,
          email: finalUser.email,
          role: finalUser.role,
          name: finalUser.name,
          profile,
          nurseProfile,
          profileComplete: isComplete,
        },
      },
      { status: 200 },
    );
    logApiSuccess(actorContext, 200, startedAt, {
      targetUserId: finalUser.id,
      role: finalUser.role,
    });
    return withRequestId(response, context.requestId);
  } catch (error) {
    const fallback = { ok: false, session: null, user: null, error: "Internal Server Error" } as const;
    const response = NextResponse.json(fallback, { status: 500 });
    logApiFailure(actorContext, error, 500, startedAt, {
      status: 500,
      fallback: false,
      source: "api.me",
    });
    return withRequestId(response, context.requestId);
  }
}
