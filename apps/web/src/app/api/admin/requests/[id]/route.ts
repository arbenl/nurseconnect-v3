import { AdminRequestDetailSchema } from "@nurseconnect/contracts";
import { NextResponse } from "next/server";
import { z } from "zod";

import { AdminRequestNotFoundError, getAdminRequestDetail } from "@/server/admin/admin-reads";
import { requireRole } from "@/server/auth";

type RouteParams = { params: { id: string } };
const IdParam = z.object({ id: z.string().uuid() });

export async function GET(_: Request, { params }: RouteParams) {
  try {
    const { user } = await requireRole("admin");

    const parsed = IdParam.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request id" }, { status: 400 });
    }

    const data = await getAdminRequestDetail({
      requestId: parsed.data.id,
      actorUserId: user.id,
    });

    const validated = AdminRequestDetailSchema.parse(data);
    return NextResponse.json(validated, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error: unknown) {
    const cause = error as { name?: string; message?: string };

    if (cause.name === "UnauthorizedError") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (cause.name === "ForbiddenError") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (cause instanceof AdminRequestNotFoundError) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    console.error("GET /api/admin/requests/[id] failed:", cause);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
