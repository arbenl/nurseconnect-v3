import { AdminPaymentTraceMutationSchema } from "@nurseconnect/contracts";
import {
  PaymentTraceConflictError,
  PaymentTraceNotFoundError,
} from "@nurseconnect/domain-payments";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authErrorResponse, requireRole } from "@/server/auth";
import {
  getAdminPaymentTrace,
  mutateAdminPaymentTrace,
} from "@/server/payments/admin-payment-trace";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/admin/requests/[id]/payments", {
    action: "admin.request.paymentTrace",
  });
  logApiStart(context, startedAt);
  let actorContext = context;

  try {
    const { user } = await requireRole("admin");
    actorContext = { ...context, actorId: user.id, actorRole: user.role };
    const { id: requestId } = await params;
    const trace = await getAdminPaymentTrace(requestId);
    const response = NextResponse.json(trace);
    logApiSuccess(actorContext, 200, startedAt, {
      action: "admin.request.paymentTrace",
      requestId,
    });
    return withRequestId(response, context.requestId);
  } catch (error) {
    const authResponse = authErrorResponse(error, actorContext, startedAt, "admin.request.paymentTrace");
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof PaymentTraceNotFoundError) {
      const response = NextResponse.json({ error: error.message }, { status: 404 });
      logApiFailure(actorContext, error, 404, startedAt, {
        source: "admin.request.paymentTrace",
      });
      return withRequestId(response, context.requestId);
    }

    logApiFailure(actorContext, error, 500, startedAt, {
      source: "admin.request.paymentTrace",
    });
    return withRequestId(
      NextResponse.json({ error: "Internal Server Error" }, { status: 500 }),
      context.requestId,
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/admin/requests/[id]/payments", {
    action: "admin.request.paymentTrace.mutate",
  });
  logApiStart(context, startedAt);
  let actorContext = context;

  try {
    const { user: actor } = await requireRole("admin");
    actorContext = { ...context, actorId: actor.id, actorRole: actor.role };
    const { id: requestId } = await params;
    const parsed = AdminPaymentTraceMutationSchema.parse(await request.json());
    const trace = await mutateAdminPaymentTrace(requestId, actor.id, parsed);
    const response = NextResponse.json(trace);
    logApiSuccess(actorContext, 200, startedAt, {
      action: "admin.request.paymentTrace.mutate",
      requestId,
      traceKind: parsed.kind,
      traceAction: parsed.action,
    });
    return withRequestId(response, context.requestId);
  } catch (error) {
    const authResponse = authErrorResponse(error, actorContext, startedAt, "admin.request.paymentTrace.mutate");
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof z.ZodError) {
      const response = NextResponse.json({ error: "Invalid payload", issues: error.issues }, { status: 400 });
      logApiFailure(actorContext, error, 400, startedAt, {
        source: "admin.request.paymentTrace.mutate",
      });
      return withRequestId(response, context.requestId);
    }

    if (error instanceof PaymentTraceNotFoundError) {
      const response = NextResponse.json({ error: error.message }, { status: 404 });
      logApiFailure(actorContext, error, 404, startedAt, {
        source: "admin.request.paymentTrace.mutate",
      });
      return withRequestId(response, context.requestId);
    }

    if (error instanceof PaymentTraceConflictError) {
      const response = NextResponse.json({ error: error.message }, { status: 409 });
      logApiFailure(actorContext, error, 409, startedAt, {
        source: "admin.request.paymentTrace.mutate",
      });
      return withRequestId(response, context.requestId);
    }

    logApiFailure(actorContext, error, 500, startedAt, {
      source: "admin.request.paymentTrace.mutate",
    });
    return withRequestId(
      NextResponse.json({ error: "Internal Server Error" }, { status: 500 }),
      context.requestId,
    );
  }
}
