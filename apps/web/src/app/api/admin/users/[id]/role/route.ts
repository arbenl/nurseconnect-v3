import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth";
import { db, schema, eq } from "@nurseconnect/database";

const { users } = schema;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Enforce RBAC
    const { user: actor } = await requireRole("admin");
    const { id: targetUserId } = await params;

    // 2. Parse Body
    const body = await request.json();
    const { role } = body;

    // 3. Validation
    if (!["admin", "nurse", "patient"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // 4. Update DB
    await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, targetUserId));

    // 5. Audit Log (Console for now)
    console.info("[AUDIT] Role Change", {
      actorId: actor.id,
      actorEmail: actor.email,
      targetUserId,
      newRole: role,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.name === "UnauthorizedError") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error.name === "ForbiddenError") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: error.message || "Internal Error" }, { status: 500 });
  }
}
