import type { GetRequestEventsResponse, RequestEventType, RequestStatus } from "@nurseconnect/contracts";
import { and, asc, db, desc, eq, gte, or, schema } from "@nurseconnect/database";

const { requestEvents, serviceRequests } = schema;

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type AppendRequestEventInput = {
  requestId: string;
  type: RequestEventType;
  actorUserId: string | null;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus | null;
  meta?: Record<string, unknown> | null;
};

type ReadRequestEventsInput = {
  requestId: string;
  actorUserId: string;
  actorRole: "admin" | "nurse" | "patient";
};

type ReadNotificationsInput = {
  actorUserId: string;
  actorRole: "admin" | "nurse" | "patient";
  sinceIso?: string | null;
  limit?: number | null;
};

export class RequestEventNotFoundError extends Error {
  constructor(message = "Request not found") {
    super(message);
    this.name = "RequestEventNotFoundError";
  }
}

export class RequestEventForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "RequestEventForbiddenError";
  }
}

function serializeEvent(event: typeof requestEvents.$inferSelect) {
  const meta =
    event.meta && typeof event.meta === "object" && !Array.isArray(event.meta)
      ? (event.meta as Record<string, unknown>)
      : null;

  return {
    ...event,
    fromStatus: event.fromStatus ?? null,
    toStatus: event.toStatus ?? null,
    actorUserId: event.actorUserId ?? null,
    meta,
    createdAt: event.createdAt.toISOString(),
  };
}

export async function appendRequestEvent(tx: Transaction, input: AppendRequestEventInput) {
  await tx.insert(requestEvents).values({
    requestId: input.requestId,
    type: input.type,
    actorUserId: input.actorUserId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    meta: input.meta ?? null,
  });
}

export async function getRequestEventsForUser(
  input: ReadRequestEventsInput
): Promise<GetRequestEventsResponse> {
  const { requestId, actorUserId, actorRole } = input;

  const requestRows = await db
    .select({
      patientUserId: serviceRequests.patientUserId,
      assignedNurseUserId: serviceRequests.assignedNurseUserId,
    })
    .from(serviceRequests)
    .where(eq(serviceRequests.id, requestId));

  const request = requestRows[0];
  if (!request) {
    throw new RequestEventNotFoundError();
  }

  const isAdmin = actorRole === "admin";
  const isPatientOwner = actorUserId === request.patientUserId;
  const isAssignedNurse =
    actorRole === "nurse" && request.assignedNurseUserId === actorUserId;

  if (!isAdmin && !isPatientOwner && !isAssignedNurse) {
    throw new RequestEventForbiddenError();
  }

  const events = await db
    .select()
    .from(requestEvents)
    .where(eq(requestEvents.requestId, requestId))
    .orderBy(asc(requestEvents.id));

  return events.map((event) => serializeEvent(event));
}

export async function getNotificationsForActor(input: ReadNotificationsInput): Promise<GetRequestEventsResponse> {
  const { actorUserId, actorRole, sinceIso, limit = 25 } = input;

  const normalizedLimit = Math.min(Math.max(limit ?? 25, 1), 100);
  const sinceDate = sinceIso ? new Date(sinceIso) : null;
  const sinceCondition = sinceDate && Number.isFinite(sinceDate.getTime())
    ? gte(requestEvents.createdAt, sinceDate)
    : null;

  if (actorRole === "admin") {
    const adminEvents = await (
      sinceCondition
        ? db
            .select()
            .from(requestEvents)
            .where(sinceCondition)
            .orderBy(desc(requestEvents.createdAt), desc(requestEvents.id))
            .limit(normalizedLimit)
        : db
            .select()
            .from(requestEvents)
            .orderBy(desc(requestEvents.createdAt), desc(requestEvents.id))
            .limit(normalizedLimit)
    );
    return adminEvents.map((event) => serializeEvent(event));
  }

  const requestIdRows = await db
    .select({ requestId: serviceRequests.id })
    .from(serviceRequests)
    .where(
      actorRole === "nurse"
        ? eq(serviceRequests.assignedNurseUserId, actorUserId)
        : eq(serviceRequests.patientUserId, actorUserId),
    );

  if (requestIdRows.length === 0) {
    return [];
  }

  const requestIdFilter = or(...requestIdRows.map((requestIdRow) => eq(requestEvents.requestId, requestIdRow.requestId)));

  const events = await (
    sinceCondition
      ? db
          .select()
          .from(requestEvents)
          .where(and(requestIdFilter, sinceCondition))
          .orderBy(desc(requestEvents.createdAt), desc(requestEvents.id))
          .limit(normalizedLimit)
      : db
          .select()
          .from(requestEvents)
          .where(requestIdFilter)
          .orderBy(desc(requestEvents.createdAt), desc(requestEvents.id))
          .limit(normalizedLimit)
  );

  return events.map((event) => serializeEvent(event));
}
