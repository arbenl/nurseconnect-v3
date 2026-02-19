import { NextResponse } from "next/server";
import { z } from "zod";

import {
  RequestConflictError,
  RequestForbiddenError,
  RequestNotFoundError,
} from "./request-actions";

export function requestActionErrorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Invalid payload", issues: error.issues }, { status: 400 });
  }
  if (error instanceof RequestForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof RequestNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof RequestConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  console.error("Request action error:", error);
  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
