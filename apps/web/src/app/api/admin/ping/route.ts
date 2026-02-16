import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth";

export async function GET() {
  try {
    const { user } = await requireRole("admin");
    return NextResponse.json({ ok: true, user: { id: user.id, role: user.role } });
  } catch (error: any) {
    if (error.name === "UnauthorizedError") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.name === "ForbiddenError") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
