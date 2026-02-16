import { NextResponse } from "next/server";
import { db, sql } from "@nurseconnect/database";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ ok: true, db: "ok" });
  } catch (err) {
    return NextResponse.json(
      { ok: false, db: "error", message: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
