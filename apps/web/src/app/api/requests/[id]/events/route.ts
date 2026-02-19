import { NextResponse } from "next/server";

import { getCachedUser } from "@/lib/auth/user";
import {
  RequestEventForbiddenError,
  RequestEventNotFoundError,
  getRequestEventsForUser,
} from "@/server/requests/request-events";

type Params = { params: { id: string } };

export async function GET(_: Request, { params }: Params) {
  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin" && user.role !== "nurse" && user.role !== "patient") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const events = await getRequestEventsForUser({
      requestId: params.id,
      actorUserId: user.id,
      actorRole: user.role,
    });

    return NextResponse.json(events);
  } catch (error) {
    if (error instanceof RequestEventNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof RequestEventForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    console.error("Request events error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
