import { headers } from "next/headers";
import { NextResponse, NextRequest } from "next/server";

import { auth } from "@/lib/auth"; // direct import for API routes

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: (session.user as any).role,
    // Add other fields from session if needed
  }, { status: 200 });
}

export async function PUT(req: NextRequest) {
  return NextResponse.json({ error: "Profile updates via this legacy route are deprecated. Use Better-Auth user management." }, { status: 410 });
}
