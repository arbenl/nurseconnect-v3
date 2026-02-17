import { db, eq, schema } from "@nurseconnect/database";
import { NextRequest, NextResponse } from "next/server";

const { authUsers, authSessions } = schema;

/**
 * Test-only endpoint to create a session for E2E tests.
 * Only works when E2E_TEST_MODE=1.
 */
export async function POST(req: NextRequest) {
    // Guard: only allow in E2E test mode
    if (process.env.E2E_TEST_MODE !== "1") {
        return new NextResponse("Not Found", { status: 404 });
    }

    try {
        const body = await req.json();
        const { email } = body;

        if (!email) {
            return NextResponse.json({ error: "Email required" }, { status: 400 });
        }

        // Find user by email
        const [user] = await db
            .select()
            .from(authUsers)
            .where(eq(authUsers.email, email))
            .limit(1);

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
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

        return response;
    } catch (error) {
        console.error("Test login error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
