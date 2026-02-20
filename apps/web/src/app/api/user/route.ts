import { UserProfile, Role as RoleSchema } from "@nurseconnect/contracts";
import { db, eq, schema } from "@nurseconnect/database";
import { zodToFieldErrors } from "@nurseconnect/ui/lib/utils";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

const { users } = schema;

type Role = z.infer<typeof RoleSchema>;

const GetUserSchema = z.object({
  id: z.string().min(1, "id (uid) is required"),
});

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const context = createApiLogContext(req, "/api/user", {
    action: "user.get",
  });
  logApiStart(context, startedAt);

  const { searchParams } = new URL(req.url);
  const query = Object.fromEntries(searchParams.entries());

  const parsed = GetUserSchema.safeParse(query);
  if (!parsed.success) {
    const response = NextResponse.json(
      { errors: zodToFieldErrors(parsed.error as any) },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
    logApiFailure(context, parsed.error, 400, startedAt, {
      source: "api.user",
    });
    return withRequestId(response, context.requestId);
  }

  try {
    const { id } = parsed.data;
    const actorContext = { ...context, actorId: id };

    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!userRecord) {
      const response = NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: { "cache-control": "no-store" } },
      );
      logApiFailure(actorContext, "User not found", 404, startedAt, {
        source: "api.user",
      });
      return withRequestId(response, context.requestId);
    }

    const rawRole = userRecord.role;
    const allowed = new Set(RoleSchema.options as readonly string[]);
    const validRole = allowed.has(rawRole) ? (rawRole as Role) : "patient";

    const profile = {
      uid: userRecord.id,
      email: userRecord.email,
      displayName: userRecord.name ?? "",
      role: validRole,
      createdAt: userRecord.createdAt.toISOString(),
      updatedAt: userRecord.updatedAt.toISOString(),
    };

    const validated = UserProfile.parse(profile);
    const response = NextResponse.json(validated, {
      headers: { "cache-control": "no-store" },
    });
    logApiSuccess(actorContext, 200, startedAt, {
      targetUserId: userRecord.id,
      source: "api.user",
    });
    return withRequestId(response, context.requestId);
  } catch (err: any) {
    logApiFailure(context, err, 500, startedAt, {
      source: "api.user",
    });
    return withRequestId(
      NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500, headers: { "cache-control": "no-store" } },
      ),
      context.requestId,
    );
  }
}
