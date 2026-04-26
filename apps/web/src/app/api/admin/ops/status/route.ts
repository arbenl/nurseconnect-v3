import type { AdminOpsStatusResponse } from "@nurseconnect/contracts";
import { db, sql } from "@nurseconnect/database";
import {
  LAUNCH_MINIMUM_VERIFIED_AVAILABLE_NURSES,
  getAdminOpsStatus,
} from "@nurseconnect/domain-admin-ops";
import { NextResponse } from "next/server";

import { authErrorResponse, requireRole } from "@/server/auth";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

function emptyOpsStatus(generatedAt: string): AdminOpsStatusResponse {
  return {
    generatedAt,
    db: "error",
    serviceAreas: { active: 0 },
    nurseSupply: {
      verifiedAndAvailable: 0,
      launchMinimum: LAUNCH_MINIMUM_VERIFIED_AVAILABLE_NURSES,
      launchShortfall: LAUNCH_MINIMUM_VERIFIED_AVAILABLE_NURSES,
      launchReady: false,
      launchServiceAreaCount: 0,
      launchLowestServiceAreaSupply: 0,
      launchServiceAreasBelowMinimum: 0,
    },
    requests: {
      unassigned: 0,
      staleAssigned: 0,
      staleEnroute: 0,
      exceptionQueue: 0,
    },
    payments: {
      authorizationsWithoutPayout: 0,
      recentFailedAuthorizations: 0,
      recentFailedPayouts: 0,
    },
  };
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/admin/ops/status", {
    action: "admin.ops.status",
  });
  logApiStart(context, startedAt);

  let actorContext = context;

  try {
    const { user } = await requireRole("admin");
    actorContext = { ...context, actorId: user.id, actorRole: user.role };

    try {
      await db.execute(sql`SELECT 1`);
    } catch (error) {
      const body = emptyOpsStatus(new Date().toISOString());
      const response = NextResponse.json(body, { status: 500 });
      logApiFailure(actorContext, error, 500, startedAt, {
        source: "admin.ops.status",
        subsystem: "db",
      });
      return withRequestId(response, context.requestId);
    }

    const counts = await getAdminOpsStatus();
    const body: AdminOpsStatusResponse = {
      ...counts,
      db: "ok",
    };
    const response = NextResponse.json(body);
    logApiSuccess(actorContext, 200, startedAt, {
      source: "admin.ops.status",
      unassigned: body.requests.unassigned,
      exceptionQueue: body.requests.exceptionQueue,
    });
    return withRequestId(response, context.requestId);
  } catch (error) {
    const authResponse = authErrorResponse(error, actorContext, startedAt, "admin.ops.status");
    if (authResponse) {
      return authResponse;
    }

    logApiFailure(actorContext, error, 500, startedAt, {
      source: "admin.ops.status",
    });
    const body = emptyOpsStatus(new Date().toISOString());
    return withRequestId(
      NextResponse.json(body, { status: 500 }),
      context.requestId,
    );
  }
}
