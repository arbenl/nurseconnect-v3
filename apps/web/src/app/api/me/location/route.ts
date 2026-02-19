import { NurseLocationUpdateRequestSchema } from "@nurseconnect/contracts";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCachedUser } from "@/lib/auth/user";
import {
  NurseLocationForbiddenError,
  updateMyNurseLocation,
} from "@/server/nurse-location/update-my-location";

export async function PATCH(request: Request) {
  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = await request.json();
    const body = NurseLocationUpdateRequestSchema.parse(json);

    const result = await updateMyNurseLocation({
      actorUserId: user.id,
      lat: body.lat,
      lng: body.lng,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 });
    }
    if (error instanceof NurseLocationForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    console.error("PATCH /api/me/location failed", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
