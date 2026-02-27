import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authErrorResponse, requireRole } from "@/server/auth";
import { getAdminReassignmentActivityFeed } from "@/server/admin/activity-feed";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/admin/activity/reassignments", {
    action: "admin.activity.reassignments",
  });
  logApiStart(context, startedAt);

  let actorContext = context;

  try {
    const { user } = await requireRole("admin");
    actorContext = { ...context, actorId: user.id, actorRole: user.role };

    const parsedQuery = querySchema.safeParse({
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    });
    if (!parsedQuery.success) {
      const response = NextResponse.json(
        { error: "Invalid query params", issues: parsedQuery.error.issues },
        { status: 400 },
      );
      logApiFailure(actorContext, parsedQuery.error, 400, startedAt, {
        source: "admin.activity.reassignments",
      });
      return withRequestId(response, context.requestId);
    }

    const feed = await getAdminReassignmentActivityFeed(parsedQuery.data.limit);
    const response = NextResponse.json(feed);
    logApiSuccess(actorContext, 200, startedAt, {
      source: "admin.activity.reassignments",
      count: feed.items.length,
    });
    return withRequestId(response, context.requestId);
  } catch (error) {
    const authResponse = authErrorResponse(error, actorContext, startedAt, "admin.activity.reassignments");
    if (authResponse) {
      return authResponse;
    }

    logApiFailure(actorContext, error, 500, startedAt, {
      source: "admin.activity.reassignments",
    });
    return withRequestId(
      NextResponse.json({ error: "Internal Server Error" }, { status: 500 }),
      context.requestId,
    );
  }
}
