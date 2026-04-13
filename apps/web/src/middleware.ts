import type { NextRequest } from "next/server";

import { proxyLogic } from "@/lib/proxy-logic";

export async function middleware(req: NextRequest) {
  return proxyLogic(req);
}

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*", "/admin/:path*"],
};
