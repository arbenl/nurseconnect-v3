import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

// Input validation
const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6), // Password handling is now delegated to Better-Auth client or separate flow, but generic signup might just upsert user profile if auth is handled elsewhere?
  // Usage of this route implies custom signup; kept as a legacy compatibility endpoint.
  // Keep the schema shape for backward compatibility only.
  displayName: z.string().optional(),
  role: z.enum(["patient", "nurse"]).optional(),
  // Password is unused in profile sync mode, kept for schema compatibility.
});

export async function POST(request: Request) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/auth/signup", {
    action: "auth.signup",
  });
  logApiStart(context, startedAt);

  const body = await request.json().catch(() => ({}));
  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    const response = NextResponse.json(
      { message: "Invalid input", errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
    logApiFailure(context, parsed.error, 400, startedAt, {
      source: "auth.signup",
    });
    return withRequestId(response, context.requestId);
  }

  const { email, displayName, role } = parsed.data;

  try {
  const response = NextResponse.json(
      {
        message: "Signup via legacy route is disabled. Please use Better-Auth flow.",
        hint: "Use client.signUp.email() instead.",
      },
      { status: 410 }, // Gone
    );
    logApiFailure(
      context,
      "Signup via legacy route is disabled. Please use Better-Auth flow.",
      410,
      startedAt,
      {
        source: "auth.signup",
      },
    );
    return withRequestId(response, context.requestId);
  } catch (error: unknown) {
    logApiFailure(context, error, 500, startedAt, {
      source: "auth.signup",
      email,
      role,
      displayName,
    });
    return withRequestId(
      NextResponse.json({ message: (error as Error)?.message ?? "Unexpected error" }, { status: 500 }),
      context.requestId,
    );
  }
}
