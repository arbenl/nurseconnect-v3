import { GetRequestEventsResponseSchema, type GetRequestEventsResponse } from "@nurseconnect/contracts";
import { asc, eq, type DbExecutor } from "@nurseconnect/database";
import { requestEvents, serviceRequests } from "@nurseconnect/database/schema";

import { VisitForbiddenError, VisitNotFoundError } from "./errors";
import { serializeVisitEvent, type VisitActorRole } from "./event-read-shared";

export async function getVisitTimelineForActor(
  db: DbExecutor,
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

  return GetRequestEventsResponseSchema.parse(events.map((event) => serializeVisitEvent(event)));
}
