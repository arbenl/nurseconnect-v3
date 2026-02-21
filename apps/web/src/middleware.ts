import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { getRequestId, withRequestId } from "@/server/telemetry/ops-logger";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const requestId = getRequestId(req.headers);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);

  // Optimistic Edge Defense-in-depth:
  // We check for the explicit presence of the Better Auth session cookie.
  // This is not cryptographically verified at the edge (handled by RSC Layouts natively),
  // but it drops anonymous traffic immediately and cleanly before hitting the origin DB.
  const hasSessionCookie = !!getSessionCookie(req);
  const requiresSessionCookie =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/me") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/requests");
  const isApiRoute = pathname.startsWith("/api/");

  let response: NextResponse;
  if (requiresSessionCookie && !hasSessionCookie) {
    if (isApiRoute) {
      response = NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: requestHeaders });
    } else {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname + (search || ""));
      response = NextResponse.redirect(loginUrl);
    }
  } else {
    response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // authenticated (probably) → allow through to server layout for strict verification
  response.headers.set("X-Request-ID", requestId);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  return withRequestId(response, requestId);
}

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*", "/admin/:path*"],
};
