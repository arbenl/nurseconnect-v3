import { GetRequestEventsResponseSchema, type GetRequestEventsResponse } from "@nurseconnect/contracts";
import { asc, eq, type DbClient } from "@nurseconnect/database";
import { requestEvents, serviceRequests } from "@nurseconnect/database/schema";

import { VisitForbiddenError, VisitNotFoundError } from "./errors";

type VisitActorRole = "admin" | "nurse" | "patient";

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

export async function getVisitTimelineForActor(
  db: DbClient,
  input: {
    requestId: string;
    actorUserId: string;
    actorRole: VisitActorRole;
  },
): Promise<GetRequestEventsResponse> {
  const { requestId, actorUserId, actorRole } = input;

  const [request] = await db
    .select({
      patientUserId: serviceRequests.patientUserId,
      assignedNurseUserId: serviceRequests.assignedNurseUserId,
    })
    .from(serviceRequests)
    .where(eq(serviceRequests.id, requestId));

  if (!request) {
    throw new VisitNotFoundError();
  }

  const isAdmin = actorRole === "admin";
  const isPatientOwner = actorUserId === request.patientUserId;
  const isAssignedNurse =
    actorRole === "nurse" && request.assignedNurseUserId === actorUserId;

  if (!isAdmin && !isPatientOwner && !isAssignedNurse) {
    throw new VisitForbiddenError();
  }

  const events = await db
    .select()
    .from(requestEvents)
    .where(eq(requestEvents.requestId, requestId))
    .orderBy(asc(requestEvents.id));

  return GetRequestEventsResponseSchema.parse(events.map((event) => serializeEvent(event)));
}
