import { CreateRequestSchema } from "@nurseconnect/contracts";
import { db } from "@nurseconnect/database";
import {
  buildPartnerRequestInput,
  getReferralPartnerProfileByUserId,
  ReferralPartnerInactiveError,
  ReferralPartnerNotFoundError,
  ReferralPartnerValidationError,
  listPartnerRequests,
} from "@nurseconnect/domain-referral";
import { RequestCreationValidationError } from "@nurseconnect/domain-request";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authErrorResponse, requireRole } from "@/server/auth";
import { createPartnerPatientShell } from "@/server/partner/create-partner-patient-shell";
import { createAndAssignRequest } from "@/server/requests/allocate-request";
import {
  createApiLogContext,
  logApiFailure,
  logApiStart,
  logApiSuccess,
  withRequestId,
} from "@/server/telemetry/ops-logger";

const CreatePartnerRequestSchema = CreateRequestSchema.omit({
  referralSource: true,
  referralPartnerId: true,
}).extend({
  patient: z.object({
    email: z.string().email(),
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    phone: z.string().trim().min(1).optional(),
    city: z.string().trim().min(1).optional(),
  }),
});

export async function GET(request: Request) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/partner/requests", {
    action: "partner.requests.list",
  });
  logApiStart(context, startedAt);

  let actorContext = context;

  try {
    const { user } = await requireRole("referral_partner");
    actorContext = { ...context, actorId: user.id, actorRole: user.role };

    const items = await listPartnerRequests(db, { actorUserId: user.id });
    const response = NextResponse.json({ items });
    logApiSuccess(actorContext, 200, startedAt, {
      source: "partner.requests.list",
      resultsCount: items.length,
    });
    return withRequestId(response, context.requestId);
  } catch (error) {
    const authResponse = authErrorResponse(error, actorContext, startedAt, "partner.requests.list");
    if (authResponse) {
      return authResponse;
    }

    if (
      error instanceof ReferralPartnerValidationError ||
      error instanceof ReferralPartnerInactiveError
    ) {
      const response = NextResponse.json({ error: (error as Error).message }, { status: 400 });
      logApiFailure(actorContext, error, 400, startedAt, { source: "partner.requests.list" });
      return withRequestId(response, context.requestId);
    }

    if (error instanceof ReferralPartnerNotFoundError) {
      const response = NextResponse.json({ error: error.message }, { status: 404 });
      logApiFailure(actorContext, error, 404, startedAt, { source: "partner.requests.list" });
      return withRequestId(response, context.requestId);
    }

    logApiFailure(actorContext, error, 500, startedAt, { source: "partner.requests.list" });
    return withRequestId(
      NextResponse.json({ error: "Internal Server Error" }, { status: 500 }),
      context.requestId,
    );
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const context = createApiLogContext(request, "/api/partner/requests", {
    action: "partner.requests.create",
  });
  logApiStart(context, startedAt);

  let actorContext = context;

  try {
    const { user } = await requireRole("referral_partner");
    actorContext = { ...context, actorId: user.id, actorRole: user.role };

    const body = CreatePartnerRequestSchema.parse(await request.json());
    const partnerProfile = await getReferralPartnerProfileByUserId({ userId: user.id });
    const patientShell = await createPartnerPatientShell(body.patient);
    const partnerRequest = buildPartnerRequestInput({
      actorUserId: user.id,
      partnerUserId: user.id,
      partnerStatus: partnerProfile.status,
      request: body,
    });

    const created = await createAndAssignRequest({
      actorUserId: user.id,
      patientUserId: patientShell.id,
      address: partnerRequest.address,
      lat: partnerRequest.lat,
      lng: partnerRequest.lng,
      requestType: partnerRequest.requestType,
      scheduledFor: partnerRequest.scheduledFor ?? null,
      referralSource: partnerRequest.referralSource,
      referralPartnerId: partnerRequest.referralPartnerId ?? null,
      careType: partnerRequest.careType ?? null,
    });

    const response = NextResponse.json(created);
    logApiSuccess(actorContext, 200, startedAt, {
      source: "partner.requests.create",
      requestId: created.id,
      patientUserId: patientShell.id,
    });
    return withRequestId(response, context.requestId);
  } catch (error) {
    const authResponse = authErrorResponse(error, actorContext, startedAt, "partner.requests.create");
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof z.ZodError) {
      const response = NextResponse.json(error.issues, { status: 400 });
      logApiFailure(actorContext, error, 400, startedAt, { source: "partner.requests.create" });
      return withRequestId(response, context.requestId);
    }

    if (
      error instanceof ReferralPartnerValidationError ||
      error instanceof ReferralPartnerNotFoundError ||
      error instanceof ReferralPartnerInactiveError
    ) {
      const response = NextResponse.json({ error: error.message }, { status: 400 });
      logApiFailure(actorContext, error, 400, startedAt, { source: "partner.requests.create" });
      return withRequestId(response, context.requestId);
    }

    if (error instanceof RequestCreationValidationError) {
      const response = NextResponse.json({ message: error.message }, { status: 400 });
      logApiFailure(actorContext, error, 400, startedAt, { source: "partner.requests.create" });
      return withRequestId(response, context.requestId);
    }

    logApiFailure(actorContext, error, 500, startedAt, { source: "partner.requests.create" });
    return withRequestId(
      NextResponse.json({ error: "Internal Server Error" }, { status: 500 }),
      context.requestId,
    );
  }
}
