import { NextResponse } from "next/server";

import { getCachedUser } from "@/lib/auth/user";
import { getNotificationsForActor } from "@/server/requests/request-events";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

function parseLimit(rawLimit: string | null) {
  if (rawLimit === null) {
    return { value: null };
  }

  const trimmed = rawLimit.trim();
  if (!/^\d+$/.test(trimmed)) {
    return { error: "limit must be an integer" };
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (parsed < 1 || parsed > 100) {
    return { error: "limit must be between 1 and 100" };
  }

  return { value: parsed };
}

function parseSince(rawSince: string | null) {
  if (rawSince === null) return { value: null };

  const trimmed = rawSince.trim();
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return { error: "since must be a valid date" };
  }

  return { value: trimmed };
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/me/notifications", {
    action: "me.notifications",
  });
  logApiStart(context, startedAt);

  const user = await getCachedUser();
  if (!user) {
    const unauthorizedContext = { ...context, actorId: undefined, actorRole: undefined };
    const response = NextResponse.json({ error: "Unauthorized" }, {
      status: 401,
      headers: NO_CACHE_HEADERS,
    });
    logApiFailure(unauthorizedContext, "Unauthorized", 401, startedAt, {
      source: "notifications",
    });
    return withRequestId(response, context.requestId);
  }

  if (user.role !== "admin" && user.role !== "nurse" && user.role !== "patient") {
    const response = NextResponse.json({ error: "Forbidden" }, {
      status: 403,
      headers: NO_CACHE_HEADERS,
    });
    logApiFailure(context, "Forbidden", 403, startedAt, {
      source: "notifications",
    });
    return withRequestId(response, context.requestId);
  }

  const actorContext = { ...context, actorId: user.id, actorRole: user.role };
  const query = new URL(request.url).searchParams;
  const sinceResult = parseSince(query.get("since"));
  if ("error" in sinceResult) {
    const response = NextResponse.json({ error: sinceResult.error }, {
      status: 400,
      headers: NO_CACHE_HEADERS,
    });
    logApiFailure(context, sinceResult.error, 400, startedAt, {
      source: "notifications",
    });
    return withRequestId(response, context.requestId);
  }

  const limitResult = parseLimit(query.get("limit"));
  if ("error" in limitResult) {
    const response = NextResponse.json({ error: limitResult.error }, {
      status: 400,
      headers: NO_CACHE_HEADERS,
    });
    logApiFailure(context, limitResult.error, 400, startedAt, {
      source: "notifications",
    });
    return withRequestId(response, context.requestId);
  }

  try {
    const notifications = await getNotificationsForActor({
      actorUserId: user.id,
      actorRole: user.role,
      sinceIso: sinceResult.value,
      limit: limitResult.value,
    });
    const response = NextResponse.json(notifications, { headers: NO_CACHE_HEADERS });
    logApiSuccess(actorContext, 200, startedAt, { count: notifications.length });
    return withRequestId(response, context.requestId);
  } catch (error) {
    logApiFailure(actorContext, error, 500, startedAt, { source: "notifications" });
    return withRequestId(
      NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500, headers: NO_CACHE_HEADERS }
      ),
      context.requestId
    );
  }
}
