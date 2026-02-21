import { NextRequest, NextResponse } from "next/server";
import { db, eq, schema } from "@nurseconnect/database";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

const { authUsers, authSessions } = schema;

/**
 * Test-only endpoint to create a session for E2E tests.
 * Only works when E2E_TEST_MODE=1.
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const context = createApiLogContext(req, "/api/test/login", {
    action: "test.login",
  });
  logApiStart(context, startedAt);

  if (process.env.E2E_TEST_MODE !== "1") {
    const response = new NextResponse("Not Found", { status: 404 });
    logApiFailure(context, "Test mode disabled", 404, startedAt, { source: "test.login" });
    return withRequestId(response, context.requestId);
  }

  try {
    const body = await req.json();
    const { email } = body as { email?: string };

    if (!email) {
      const response = NextResponse.json({ error: "Email required" }, { status: 400 });
      logApiFailure(context, "Email missing", 400, startedAt, {
        source: "test.login",
      });
      return withRequestId(response, context.requestId);
    }

    // Find user by email
    const [user] = await db
      .select()
      .from(authUsers)
      .where(eq(authUsers.email, email))
      .limit(1);

    if (!user) {
      const response = NextResponse.json({ error: "User not found" }, { status: 404 });
      logApiFailure(context, "User not found", 404, startedAt, { source: "test.login" });
      return withRequestId(response, context.requestId);
    }

    // Generate session token and ID
    const sessionId = `test_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const sessionToken = `test_session_${Date.now()}_${Math.random().toString(36)}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Insert session directly into database
    await db.insert(authSessions).values({
      id: sessionId,
      userId: user.id,
      token: sessionToken,
      expiresAt,
      ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
      userAgent: req.headers.get("user-agent") || "playwright",
    });

    // Set session cookie
    const response = NextResponse.json({ success: true, userId: user.id });
    response.cookies.set("better-auth.session_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    logApiSuccess(context, 200, startedAt, {
      source: "test.login",
      userId: user.id,
    });
    return withRequestId(response, context.requestId);
  } catch (error) {
    logApiFailure(context, error, 500, startedAt, { source: "test.login" });
    return withRequestId(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      context.requestId,
    );
  }
}
