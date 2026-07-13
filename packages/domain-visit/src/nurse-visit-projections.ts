import {
  NurseVisitFeedResponseSchema,
  NurseVisitSummarySchema,
  type NurseVisitFeedResponse,
  type NurseVisitSummary,
} from "@nurseconnect/contracts";
import {
  and,
  desc,
  eq,
  lt,
  ne,
  or,
  type DbExecutor,
} from "@nurseconnect/database";
import { serviceRequests } from "@nurseconnect/database/schema";
import type { SQL } from "drizzle-orm";

import type { VisitHistoryCursor } from "./patient-visit-projections";
import { isVisitActive } from "./visit-state";

const DEFAULT_HISTORY_LIMIT = 5;
const MIN_HISTORY_LIMIT = 1;
const MAX_HISTORY_LIMIT = 100;

function normalizeHistoryLimit(limit?: number | null): number | null {
  if (limit === null) {
    return null;
  }

  const requestedLimit = limit ?? DEFAULT_HISTORY_LIMIT;
  return Math.min(Math.max(requestedLimit, MIN_HISTORY_LIMIT), MAX_HISTORY_LIMIT);
}

function buildHistoryCursorCondition(cursor?: VisitHistoryCursor | null) {
  if (!cursor) {
    return null;
  }

  const createdAt = new Date(cursor.createdAt);
  if (!Number.isFinite(createdAt.getTime())) {
    return null;
  }

  return or(
    lt(serviceRequests.createdAt, createdAt),
    and(eq(serviceRequests.createdAt, createdAt), lt(serviceRequests.id, cursor.id)),
  );
}

function isSqlCondition(condition: SQL | undefined | null): condition is SQL {
  return condition !== null && condition !== undefined;
}

function mapToNurseVisitSummary(
  request: typeof serviceRequests.$inferSelect,
): NurseVisitSummary {
  return NurseVisitSummarySchema.parse({
    id: request.id,
    address: request.address,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    requestType: request.requestType,
    scheduledFor: request.scheduledFor?.toISOString() ?? null,
    careType: request.careType ?? null,
  });
}

export async function getNurseVisitProjection(
  db: DbExecutor,
  input: {
    actorUserId: string;
    historyLimit?: number | null;
    historyCursor?: VisitHistoryCursor | null;
  },
): Promise<
  NurseVisitFeedResponse & {
    nextHistoryCursor: VisitHistoryCursor | null;
  }
> {
  const { actorUserId, historyCursor } = input;
  const historyLimit = normalizeHistoryLimit(input.historyLimit);

  const [activeAssignmentRow] = await db
    .select()
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.assignedNurseUserId, actorUserId),
        or(
          eq(serviceRequests.status, "assigned"),
          eq(serviceRequests.status, "accepted"),
          eq(serviceRequests.status, "enroute"),
        ),
      ),
    )
    .orderBy(desc(serviceRequests.createdAt), desc(serviceRequests.id))
    .limit(1);

  const activeAssignment =
    activeAssignmentRow && isVisitActive(activeAssignmentRow.status)
      ? mapToNurseVisitSummary(activeAssignmentRow)
      : null;
  const cursorCondition = buildHistoryCursorCondition(historyCursor);
  const historyConditions = [
    eq(serviceRequests.assignedNurseUserId, actorUserId),
    activeAssignmentRow ? ne(serviceRequests.id, activeAssignmentRow.id) : null,
    cursorCondition,
  ].filter(isSqlCondition);

  const historyQuery = db
    .select()
    .from(serviceRequests)
    .where(and(...historyConditions))
    .orderBy(desc(serviceRequests.createdAt), desc(serviceRequests.id));
  const historyRows =
    historyLimit === null
      ? await historyQuery
      : await historyQuery.limit(historyLimit + 1);

  const pageRows = historyLimit === null ? historyRows : historyRows.slice(0, historyLimit);
  const recentAssignments = pageRows.map((request) => mapToNurseVisitSummary(request));
  const lastRow = pageRows.at(-1);
  const nextHistoryCursor =
    historyLimit !== null && historyRows.length > historyLimit && lastRow
      ? {
          createdAt: lastRow.createdAt.toISOString(),
          id: lastRow.id,
        }
      : null;
  const response = NurseVisitFeedResponseSchema.parse({
    activeAssignment,
    recentAssignments,
  });

  return {
    ...response,
    nextHistoryCursor,
  };
}
