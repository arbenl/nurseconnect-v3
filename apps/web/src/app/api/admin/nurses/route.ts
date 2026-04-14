import { NextResponse } from "next/server";

import { listNurseCredentials } from "@/server/admin/nurse-credentials";
import { requireRole } from "@/server/auth";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/admin/nurses", {
    action: "admin.nurses.listQueue",
  });
  logApiStart(context, startedAt);

  let actorContext = context;

  try {
    const { user: actor } = await requireRole("admin");
    actorContext = { ...context, actorId: actor.id, actorRole: actor.role };
    const statusParam = new URL(request.url).searchParams.get("status");
    const statuses = statusParam?.split(",").map((value) => value.trim()).filter(Boolean);
    const queue = await listNurseCredentials(statuses);

    const response = NextResponse.json({
      items: queue.map((item) => ({
        id: item.id,
        userId: item.userId,
        status: item.status,
        licenseNumber: item.licenseNumber,
        licenseJurisdiction: item.licenseJurisdiction,
        specialization: item.specialization,
        licenseValidUntil: item.licenseValidUntil?.toISOString() ?? null,
        verifiedBy: item.verifiedBy,
        verifiedAt: item.verifiedAt?.toISOString() ?? null,
        suspendedAt: item.suspendedAt?.toISOString() ?? null,
        suspensionReason: item.suspensionReason,
        isAvailable: item.isAvailable,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        user: {
          id: item.userId,
          name: item.userName,
          email: item.userEmail,
          role: item.userRole,
        },
      })),
    });
    logApiSuccess(actorContext, 200, startedAt, { source: "admin.nurses.listQueue", resultsCount: queue.length });
    return withRequestId(response, context.requestId);
  } catch (error) {
    const err = error as { name?: string };
    if (err?.name === "UnauthorizedError") {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      logApiFailure(context, "Unauthorized", 401, startedAt, { source: "admin.nurses.listQueue" });
      return withRequestId(response, context.requestId);
    }
    if (err?.name === "ForbiddenError") {
      const response = NextResponse.json({ error: "Forbidden" }, { status: 403 });
      logApiFailure(actorContext, "Forbidden", 403, startedAt, { source: "admin.nurses.listQueue" });
      return withRequestId(response, context.requestId);
    }
    logApiFailure(actorContext, error, 500, startedAt, { source: "admin.nurses.listQueue" });
    return withRequestId(
      NextResponse.json({ error: "Internal Server Error" }, { status: 500 }),
      context.requestId,
    );
  }
}
