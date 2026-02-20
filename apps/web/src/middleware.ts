import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Optimistic Edge Defense-in-depth:
  // We check for the explicit presence of the Better Auth session cookie.
  // This is not cryptographically verified at the edge (handled by RSC Layouts natively),
  // but it drops anonymous traffic immediately and cleanly before hitting the origin DB.
  const hasSessionCookie =
    req.cookies.has("better-auth.session_token") ||
    req.cookies.has("__Secure-better-auth.session_token");

  if (!hasSessionCookie) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname + (search || ""));
    return NextResponse.redirect(loginUrl);
  }

  // authenticated (probably) → allow through to server layout for strict verification
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
