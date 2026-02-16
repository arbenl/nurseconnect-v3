import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth";
// import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { db } from "@/legacy/firebase/db-admin";
import { z } from "zod";
import { isRole, type Role } from "../../../types/role";

// --- minimal structured logging ---
function log(ev: Record<string, unknown>) {
  try {
    // Keep it tiny and JSON—OPS-friendly
    console.log(JSON.stringify({ ts: Date.now(), src: "api/profile", ...ev }));
  } catch {}
}

// --- BEST-EFFORT tiny rate-limit (per-process, for dev) ---
const rl = new Map<string, number[]>();
const LIMIT = 10; // 10 requests
const INTERVAL_MS = 30_000; // per 30s
function allowKey(key: string) {
  const now = Date.now();
  const arr = rl.get(key) ?? [];
  const recent = arr.filter((t) => now - t < INTERVAL_MS);
  recent.push(now);
  rl.set(key, recent);
  return recent.length <= LIMIT;
}

// -- utils
function deny(status = 401, message = "Unauthorized") {
  log({ event: "deny", status, message });
  return NextResponse.json({ error: message }, { status });
}

function getUidFromSession(session: any): string | null {
  const uid = session?.user?.id ?? (session as any)?.user?.sub ?? null;
  return typeof uid === "string" ? uid : null;
}

function getRoleFromSession(session: any): Role | undefined {
  const role = session?.user?.role;
  if (isRole(role)) return role;
  return undefined;
}

// -- Zod schema for PUT
const PutBody = z.object({
  displayName: z.string().trim().max(120).optional(),
  role: z.enum(["patient", "nurse", "admin"]).optional(),
});

export async function GET(req: NextRequest) {
  // rate-limit by ip
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!allowKey(`GET:${ip}`)) return deny(429, "Too Many Requests");

  const session = await getServerSession();
  if (!session) return deny();
  const uid = getUidFromSession(session);
  if (!uid) return deny(403, "No user id on session");

  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();

  if (!snap.exists) {
    const shell = {
      id: uid,
      role: "patient" as Role,
      displayName: session.user?.name ?? "",
      email: session.user?.email ?? "",
      createdAt: new Date().toISOString(),
    };
    await userRef.set(shell);
    log({ event: "profile_get_created", uid });
    return NextResponse.json(shell, { status: 200 });
  }

  const data = snap.data() || {};
  log({ event: "profile_get_ok", uid });
  return NextResponse.json({ id: uid, ...data }, { status: 200 });
}

export async function PUT(req: NextRequest) {
  // rate-limit by ip
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!allowKey(`PUT:${ip}`)) return deny(429, "Too Many Requests");

  // const session = await getServerSession(authOptions)
  const session = await getServerSession();
  if (!session) return deny();
  const uid = getUidFromSession(session);
  if (!uid) return deny(403, "No user id on session");

  const json = await req.json().catch(() => ({}));
  const parsed = PutBody.safeParse(json);
  if (!parsed.success) {
    log({ event: "profile_put_bad_body", uid, issues: parsed.error.issues });
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const update: Record<string, unknown> = {};
  if (typeof parsed.data.displayName === "string") {
    update.displayName = parsed.data.displayName;
  }

  if (typeof parsed.data.role === "string") {
    const nextRole = parsed.data.role as Role;
    if (!isRole(nextRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    // Non-admins cannot self-elevate to admin
    const currentRole = getRoleFromSession(session);
    if (nextRole === "admin" && currentRole !== "admin") {
      return deny(403, "Only admins can set admin role");
    }
    update.role = nextRole;
  }

  if (Object.keys(update).length === 0) {
    log({ event: "profile_put_noop", uid });
    return NextResponse.json({ ok: true, noop: true }, { status: 200 });
  }

  await db.collection("users").doc(uid).set(update, { merge: true });
  // PERF: no second read
  log({ event: "profile_put_ok", uid, update });
  return NextResponse.json({ id: uid, ...update }, { status: 200 });
}
