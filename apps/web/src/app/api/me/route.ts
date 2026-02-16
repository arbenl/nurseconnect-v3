import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/server/auth";
import { upsertUserFromSession } from "@/lib/user-service";

export async function GET() {
  const session = await getSession();
  
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ ok: true, user: null }, { status: 200 });
  }

  // Bootstrap domain user from session
  const user = await upsertUserFromSession({
    id: session.user.id,
    email: session.user.email!,
    name: session.user.name,
    image: session.user.image,
  });
  
  return NextResponse.json({ ok: true, user }, { status: 200 });
}
