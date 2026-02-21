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
  const isAuthRoute =
    pathname.startsWith("/api/better-auth") || pathname.startsWith("/api/auth");
  const isTestRoute = pathname.startsWith("/api/test/");
  const isHealthRoute =
    pathname === "/api/health" || pathname.startsWith("/api/health/");
  const requiresSessionCookie =
    !isAuthRoute &&
    !isTestRoute &&
    !isHealthRoute &&
    (pathname.startsWith("/dashboard") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/api/me") ||
      pathname.startsWith("/api/admin") ||
      pathname.startsWith("/api/requests"));
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
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests",
  );
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(), accelerometer=(), gyroscope=(), magnetometer=()",
  );
  return withRequestId(response, requestId);
}

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*", "/admin/:path*"],
};
