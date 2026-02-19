import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminUsers } from "@/server/admin/admin-reads";
import { requireRole } from "@/server/auth";

const RouteParams = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    await requireRole("admin");

    const query = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = RouteParams.safeParse(query);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query params", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const response = await getAdminUsers({
      limit: parsed.data.limit,
      cursor: parsed.data.cursor,
    });

    return NextResponse.json(response, {
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

    console.error("GET /api/admin/users failed:", cause);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
