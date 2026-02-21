import { db, sql } from "@nurseconnect/database";
import { NextRequest, NextResponse } from "next/server";

import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/health/db", {
    action: "health.db",
  });
  logApiStart(context, startedAt);

  try {
    await db.execute(sql`SELECT 1`);
    const response = NextResponse.json({ ok: true, db: "ok" });
    logApiSuccess(context, 200, startedAt, { source: "health.db" });
    return withRequestId(response, context.requestId);
  } catch (err) {
    const response = NextResponse.json(
      { ok: false, db: "error", message: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
    logApiFailure(context, err, 500, startedAt, {
      source: "health.db",
    });
    return withRequestId(response, context.requestId);
  }
}
