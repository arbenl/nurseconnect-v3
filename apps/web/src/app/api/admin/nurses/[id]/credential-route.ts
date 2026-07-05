import { NextResponse } from "next/server";

import { credentialAuthorityForAdmin } from "@/server/admin/nurse-credential-authz";
import { requireRole } from "@/server/auth";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

type ParseResult<TData> = { success: true; data: TData } | { success: false; error: unknown };
type SafeParser<TData> = { safeParse(value: unknown): ParseResult<TData> };
type NurseResponse = { status: string };
type CredentialAuthority = Awaited<ReturnType<typeof credentialAuthorityForAdmin>>;

type CredentialRouteConfig<TData> = {
  action: "reject" | "suspend" | "verify";
  schema: SafeParser<TData>;
  mutate: (
    input: {
      actorUserId: string;
      nurseId: string;
      authority: CredentialAuthority;
      data: TData;
    },
  ) => Promise<NurseResponse | null>;
};

type RouteProps = { params: Promise<{ id: string }> };

export async function handleCredentialRoute<TData>(
  request: Request,
  props: RouteProps,
  config: CredentialRouteConfig<TData>,
) {
  const params = await props.params;
  const startedAt = Date.now();
  const source = `admin.nurses.${config.action}`;
  const context = createApiLogContext(request, `/api/admin/nurses/${params.id}/${config.action}`, {
    action: source,
  });
  logApiStart(context, startedAt);

  let actorContext = context;

  try {
    const { user: actor } = await requireRole("admin");
    actorContext = { ...context, actorId: actor.id, actorRole: actor.role };
    const parsed = config.schema.safeParse(await request.json());
    if (!parsed.success) {
      const response = NextResponse.json({ error: "Invalid data", details: parsed.error }, { status: 400 });
      logApiFailure(actorContext, parsed.error, 400, startedAt, { source });
      return withRequestId(response, context.requestId);
    }

    const authority = await credentialAuthorityForAdmin(actor.id);
    const nurse = await config.mutate({
      actorUserId: actor.id,
      nurseId: params.id,
      authority,
      data: parsed.data,
    });
    if (!nurse) {
      const response = NextResponse.json({ error: "Nurse not found" }, { status: 404 });
      logApiFailure(actorContext, "Nurse not found", 404, startedAt, { source });
      return withRequestId(response, context.requestId);
    }

    const response = NextResponse.json({ ok: true, status: nurse.status, nurse });
    logApiSuccess(actorContext, 200, startedAt, { source });
    return withRequestId(response, context.requestId);
  } catch (error) {
    return handleCredentialRouteError(error, {
      actorContext,
      context,
      source,
      startedAt,
    });
  }
}

function handleCredentialRouteError(
  error: unknown,
  input: {
    actorContext: ReturnType<typeof createApiLogContext>;
    context: ReturnType<typeof createApiLogContext>;
    source: string;
    startedAt: number;
  },
) {
  const err = error as { name?: string };
  if (err?.name === "NurseCredentialValidationError") {
    const response = NextResponse.json({ error: error instanceof Error ? error.message : "Invalid nurse credential" }, { status: 400 });
    logApiFailure(input.actorContext, error, 400, input.startedAt, { source: input.source });
    return withRequestId(response, input.context.requestId);
  }
  if (err?.name === "NurseCredentialConflictError") {
    const response = NextResponse.json({ error: "Nurse credential status changed" }, { status: 409 });
    logApiFailure(input.actorContext, error, 409, input.startedAt, { source: input.source });
    return withRequestId(response, input.context.requestId);
  }
  if (err?.name === "UnauthorizedError") {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    logApiFailure(input.context, "Unauthorized", 401, input.startedAt, { source: input.source });
    return withRequestId(response, input.context.requestId);
  }
  if (err?.name === "ForbiddenError") {
    const response = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    logApiFailure(input.actorContext, "Forbidden", 403, input.startedAt, { source: input.source });
    return withRequestId(response, input.context.requestId);
  }
  logApiFailure(input.actorContext, error, 500, input.startedAt, { source: input.source });
  return withRequestId(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }), input.context.requestId);
}
