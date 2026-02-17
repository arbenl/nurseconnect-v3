import { UserProfile, Role as RoleSchema } from "@nurseconnect/contracts";
import { db, eq, schema } from "@nurseconnect/database";
import { zodToFieldErrors } from "@nurseconnect/ui/lib/utils";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const { users } = schema;

type Role = z.infer<typeof RoleSchema>;

function toNonEmptyRoles(arr: Role[] | undefined): [Role, ...Role[]] {
  return arr && arr.length ? [arr[0]!, ...arr.slice(1)] : ["staff"];
}

const GetUserSchema = z.object({
  id: z.string().min(1, "id (uid) is required"),
});

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = Object.fromEntries(searchParams.entries());

  const parsed = GetUserSchema.safeParse(query);
  if (!parsed.success) {
    return NextResponse.json(
      { errors: zodToFieldErrors(parsed.error as any) },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const { id } = parsed.data;

    // Query Postgres instead of Firebase
    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!userRecord) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: { "cache-control": "no-store" } },
      );
    }

    // Adapt DB user to UserProfile contract
    // DB has single role, contract expects array
    const rawRole = userRecord.role;
    const allowed = new Set(RoleSchema.options as readonly string[]);

    // Validate role against schema (cast to RoleSchema type)
    const validRole = allowed.has(rawRole) ? (rawRole as Role) : "staff";

    const roles: [Role, ...Role[]] = [validRole];

    const profile = {
      uid: userRecord.id, // map id -> uid
      email: userRecord.email,
      displayName: userRecord.name ?? "",
      roles,
      createdAt: userRecord.createdAt.toISOString(),
      updatedAt: userRecord.updatedAt.toISOString(),
    };

    const validated = UserProfile.parse(profile);
    return NextResponse.json(validated, {
      headers: { "cache-control": "no-store" },
    });
  } catch (err: any) {
    console.error("GET /api/user failed", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
