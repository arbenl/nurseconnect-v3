import { GetRequestEventsResponseSchema, type GetRequestEventsResponse } from "@nurseconnect/contracts";
import {
  and,
  desc,
  eq,
  gte,
  lt,
  or,
  type DbExecutor,
} from "@nurseconnect/database";
import { requestEvents, serviceRequests } from "@nurseconnect/database/schema";
import type { SQL } from "drizzle-orm";

import { serializeVisitEvent, type VisitActorRole } from "./event-read-shared";

const DEFAULT_NOTIFICATIONS_LIMIT = 25;
const MIN_NOTIFICATIONS_LIMIT = 1;
const MAX_NOTIFICATIONS_LIMIT = 100;

export type VisitNotificationCursor = {
  createdAt: string;
  id: number;
};

function normalizeNotificationsLimit(limit?: number | null) {
  const requestedLimit = limit ?? DEFAULT_NOTIFICATIONS_LIMIT;
  return Math.min(Math.max(requestedLimit, MIN_NOTIFICATIONS_LIMIT), MAX_NOTIFICATIONS_LIMIT);
}

function buildSinceCondition(sinceIso?: string | null) {
  if (!sinceIso) {
    return null;
  }

  const since = new Date(sinceIso);
  if (!Number.isFinite(since.getTime())) {
    return null;
  }

  return gte(requestEvents.createdAt, since);
}

function buildCursorCondition(cursor?: VisitNotificationCursor | null) {
  if (!cursor) {
    return null;
  }

  const createdAt = new Date(cursor.createdAt);
  if (!Number.isFinite(createdAt.getTime())) {
    return null;
  }

  return or(
    lt(requestEvents.createdAt, createdAt),
    and(eq(requestEvents.createdAt, createdAt), lt(requestEvents.id, cursor.id)),
  );
}

function isSqlCondition(condition: SQL | undefined | null): condition is SQL {
  return condition !== null && condition !== undefined;
}

export async function getVisitNotificationsForActor(
  db: DbExecutor,
  input: {
    actorUserId: string;
    actorRole: VisitActorRole;
    sinceIso?: string | null;
    limit?: number | null;
    cursor?: VisitNotificationCursor | null;
  },
): Promise<{
  notifications: GetRequestEventsResponse;
  nextCursor: VisitNotificationCursor | null;
}> {
  const { actorUserId, actorRole } = input;
  const normalizedLimit = normalizeNotificationsLimit(input.limit);
  const sinceCondition = buildSinceCondition(input.sinceIso);
  const cursorCondition = buildCursorCondition(input.cursor);

  if (actorRole === "admin") {
    const adminConditions = [sinceCondition, cursorCondition].filter(isSqlCondition);
    const adminRows = await db
      .select()
      .from(requestEvents)
      .where(adminConditions.length > 0 ? and(...adminConditions) : undefined)
      .orderBy(desc(requestEvents.createdAt), desc(requestEvents.id))
      .limit(normalizedLimit + 1);

    const pageRows = adminRows.slice(0, normalizedLimit);
    const notifications = GetRequestEventsResponseSchema.parse(
      pageRows.map((event) => serializeVisitEvent(event)),
    );
    const lastRow = pageRows.at(-1);

    return {
      notifications,
      nextCursor:
        adminRows.length > normalizedLimit && lastRow
          ? {
              createdAt: lastRow.createdAt.toISOString(),
              id: lastRow.id,
            }
          : null,
    };
  }

  const actorRequestCondition =
    actorRole === "nurse"
      ? eq(serviceRequests.assignedNurseUserId, actorUserId)
      : eq(serviceRequests.patientUserId, actorUserId);
  const joinedConditions = [actorRequestCondition, sinceCondition, cursorCondition].filter(
    isSqlCondition,
  );

  const rows = await db
    .select({ event: requestEvents })
    .from(serviceRequests)
    .innerJoin(requestEvents, eq(requestEvents.requestId, serviceRequests.id))
    .where(and(...joinedConditions))
    .orderBy(desc(requestEvents.createdAt), desc(requestEvents.id))
    .limit(normalizedLimit + 1);

  const pageRows = rows.slice(0, normalizedLimit);
  const notifications = GetRequestEventsResponseSchema.parse(
    pageRows.map((row) => serializeVisitEvent(row.event)),
  );
  const lastRow = pageRows.at(-1)?.event;

  return {
    notifications,
    nextCursor:
      rows.length > normalizedLimit && lastRow
        ? {
            createdAt: lastRow.createdAt.toISOString(),
            id: lastRow.id,
          }
        : null,
  };
}
