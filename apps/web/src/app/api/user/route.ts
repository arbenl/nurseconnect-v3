import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { zodToFieldErrors } from "@nurseconnect/ui/lib/utils";
import { UserProfile, Role as RoleSchema } from "@nurseconnect/contracts";
import { adminAuth as auth } from "@/lib/firebase/admin";
// import { authOptions } from '@/lib/auth/config'; // if you want to gate with NextAuth
// import { getServerSession } from 'next-auth';

type Role = z.infer<typeof RoleSchema>;

function toNonEmptyRoles(arr: Role[] | undefined): [Role, ...Role[]] {
  return arr && arr.length ? [arr[0]!, ...arr.slice(1)] : ["staff"];
}

const GetUserSchema = z.object({
  id: z.string().min(1, "id (uid) is required"),
});

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Optional: gate access
  // const session = await getServerSession(authOptions);
  // if (!session) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }
  // // Example policy: only admins can read arbitrary users; non-admins must match
  // const isAdmin = session.user?.roles?.includes('admin');
  // const requestedUid = new URL(req.url).searchParams.get('id');
  // if (!isAdmin && session.user?.id !== requestedUid) {
  //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // }

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
    const admin = auth;
    const userRecord = await admin.getUser(id);

    // Safer roles handling
    const rawRoles = userRecord.customClaims?.roles;
    const allowed = new Set(RoleSchema.options as readonly string[]);

    const claimsRoles: Role[] = Array.isArray(rawRoles)
      ? (rawRoles.filter(
          (r): r is Role => typeof r === "string" && allowed.has(r),
        ) as Role[])
      : [];

    const roles: [Role, ...Role[]] = toNonEmptyRoles(claimsRoles);

    const profile = {
      uid: userRecord.uid,
      email: userRecord.email ?? "",
      displayName: userRecord.displayName ?? "",
      roles,
      createdAt: userRecord.metadata.creationTime ?? new Date().toISOString(),
      updatedAt:
        userRecord.metadata.lastSignInTime ??
        userRecord.metadata.creationTime ??
        new Date().toISOString(),
    };

    const validated = UserProfile.parse(profile);
    return NextResponse.json(validated, {
      headers: { "cache-control": "no-store" },
    });
  } catch (err: any) {
    if (err?.code === "auth/user-not-found") {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: { "cache-control": "no-store" } },
      );
    }
    // TODO: logger.error({ err }, 'GET /api/user failed');
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
