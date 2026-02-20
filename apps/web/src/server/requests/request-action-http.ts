import { NextResponse } from "next/server";
import { z } from "zod";

import { logApiFailure } from "@/server/telemetry/ops-logger";
import type { ApiLogContext } from "@/server/telemetry/ops-logger";

import {
  RequestConflictError,
  RequestForbiddenError,
  RequestNotFoundError,
} from "./request-actions";

export function requestActionErrorResponse(error: unknown, context?: ApiLogContext, startedAt?: number) {
  if (error instanceof z.ZodError) {
    const response = NextResponse.json({ error: "Invalid payload", issues: error.issues }, { status: 400 });
    if (context && startedAt) {
      logApiFailure(context, error, 400, startedAt, {
        source: "request-action-http",
      });
    }
    return response;
  }
  if (error instanceof RequestForbiddenError) {
    const response = NextResponse.json({ error: error.message }, { status: 403 });
    if (context && startedAt) {
      logApiFailure(context, error, 403, startedAt, {
        source: "request-action-http",
      });
    }
    return response;
  }
  if (error instanceof RequestNotFoundError) {
    const response = NextResponse.json({ error: error.message }, { status: 404 });
    if (context && startedAt) {
      logApiFailure(context, error, 404, startedAt, {
        source: "request-action-http",
      });
    }
    return response;
  }
  if (error instanceof RequestConflictError) {
    const response = NextResponse.json({ error: error.message }, { status: 409 });
    if (context && startedAt) {
      logApiFailure(context, error, 409, startedAt, {
        source: "request-action-http",
      });
    }
    return response;
  }

  if (context && startedAt) {
    logApiFailure(context, error, 500, startedAt, {
      source: "request-action-http",
    });
  }
  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
