import { NextResponse } from "next/server";

import { getCachedUser } from "@/lib/auth/user";
import { requestActionErrorResponse } from "@/server/requests/request-action-http";
import { applyRequestAction } from "@/server/requests/request-actions";

type Params = { params: { id: string } };

export async function POST(_: Request, { params }: Params) {
  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const updated = await applyRequestAction({
      requestId: params.id,
      actorUserId: user.id,
      action: "complete",
    });

    return NextResponse.json({ request: updated });
  } catch (error) {
    return requestActionErrorResponse(error);
  }
}
