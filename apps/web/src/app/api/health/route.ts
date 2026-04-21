import type { HealthResponse } from "@nurseconnect/contracts";
import { count, db, eq, schema, sql } from "@nurseconnect/database";
import { getVerifiedAndAvailableNurseCount } from "@nurseconnect/domain-nurse";
import { NextResponse } from "next/server";

import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

const { serviceAreas } = schema;

async function getActiveServiceAreaCount() {
  const [row] = await db
    .select({ value: count() })
    .from(serviceAreas)
    .where(eq(serviceAreas.status, "active"));

  return Number(row?.value ?? 0);
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/health", {
    action: "health.composite",
  });
  logApiStart(context, startedAt);

  try {
    const [, activeServiceAreas, verifiedAndAvailable] = await Promise.all([
      db.execute(sql`SELECT 1`),
      getActiveServiceAreaCount(),
      getVerifiedAndAvailableNurseCount(),
    ]);

    const body: HealthResponse = {
      ok: true,
      db: "ok",
      serviceAreas: { active: activeServiceAreas },
      nurseSupply: { verifiedAndAvailable },
      timestamp: new Date().toISOString(),
    };
    const response = NextResponse.json(body);
    logApiSuccess(context, 200, startedAt, {
      source: "health.composite",
      activeServiceAreas,
      verifiedAndAvailable,
    });
    return withRequestId(response, context.requestId);
  } catch (error) {
    const body: HealthResponse = {
      ok: false,
      db: "error",
      serviceAreas: { active: 0 },
      nurseSupply: { verifiedAndAvailable: 0 },
      timestamp: new Date().toISOString(),
    };
    const response = NextResponse.json(body, { status: 500 });
    logApiFailure(context, error, 500, startedAt, {
      source: "health.composite",
    });
    return withRequestId(response, context.requestId);
  }
}
