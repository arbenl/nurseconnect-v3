import { NextResponse } from "next/server";

import { ensureDomainUserFromSession, maybeBootstrapFirstAdmin } from "@/lib/user-service";
import { getSession } from "@/server/auth";

export async function GET() {
  const session = await getSession();

  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ ok: true, user: null }, { status: 200 });
  }

  try {
    // 1. Sync session user to domain DB
    const domainUser = await ensureDomainUserFromSession({
      id: session.user.id,
      email: session.user.email!,
      name: session.user.name,
      image: session.user.image,
    });

    if (!domainUser) {
      throw new Error("Failed to upsert domain user");
    }

    // 2. Attempt to bootstrap admin rights (first user / allowlist)
    const finalUser = await maybeBootstrapFirstAdmin(domainUser);

    return NextResponse.json({ ok: true, user: finalUser }, { status: 200 });
  } catch (error) {
    console.error("GET /api/me failed", error);
    // Return session user as fallback if DB fails, but log error
    return NextResponse.json({ ok: true, user: session.user, error: "Sync failed" }, { status: 200 });
  }
}
