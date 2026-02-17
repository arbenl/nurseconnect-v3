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
    // 2. Attempt to bootstrap admin rights (first user / allowlist)
    const bootstrappedUser = await maybeBootstrapFirstAdmin(domainUser);
    const finalUser = bootstrappedUser ?? domainUser;

    // 3. Construct profile object
    const profile = {
      firstName: finalUser.firstName,
      lastName: finalUser.lastName,
      phone: finalUser.phone,
      city: finalUser.city,
      address: finalUser.address,
    };

    // 4. Determine completeness (all required fields present)
    const isComplete = !!(
      finalUser.firstName &&
      finalUser.lastName &&
      finalUser.phone &&
      finalUser.city
    );

    // 5. Return unified response
    return NextResponse.json(
      {
        ok: true,
        session,
        user: {
          id: finalUser.id,
          authId: finalUser.authId,
          email: finalUser.email,
          role: finalUser.role,
          name: finalUser.name, // Keep existing name field for backward compat if needed
          profile,
          profileComplete: isComplete,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /api/me failed", error);
    // Return session user as fallback if DB fails, but log error
    return NextResponse.json(
      { ok: true, session, user: null, error: "Sync failed" },
      { status: 200 }, // Keep 200 to avoid breaking clients, just explicit null user
    );
  }
}
