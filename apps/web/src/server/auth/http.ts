import { NextResponse } from "next/server";

import type { ApiLogContext } from "@/server/telemetry/ops-logger";
import { logApiFailure, withRequestId } from "@/server/telemetry/ops-logger";

import { UnauthorizedError } from "./require-auth";
import { ForbiddenError } from "./require-role";

export function authErrorResponse(
  error: unknown,
  context: ApiLogContext,
  startedAt: number,
  source: string,
) {
  if (error instanceof UnauthorizedError) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    logApiFailure(context, error, 401, startedAt, { source });
    return withRequestId(response, context.requestId);
  }

  if (error instanceof ForbiddenError) {
    const response = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    logApiFailure(context, error, 403, startedAt, { source });
    return withRequestId(response, context.requestId);
  }

  return null;
}
