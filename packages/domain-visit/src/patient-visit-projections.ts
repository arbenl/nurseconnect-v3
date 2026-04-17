import {
  GetPatientVisitsResponseSchema,
  PatientVisitSummarySchema,
  type GetPatientVisitsResponse,
  type PatientVisitSummary,
} from "@nurseconnect/contracts";
import {
  and,
  desc,
  eq,
  lt,
  ne,
  or,
  type DbClient,
} from "@nurseconnect/database";
import { serviceRequests } from "@nurseconnect/database/schema";
import type { SQL } from "drizzle-orm";

const DEFAULT_HISTORY_LIMIT = 25;
const MIN_HISTORY_LIMIT = 1;
const MAX_HISTORY_LIMIT = 100;
const ACTIVE_PATIENT_REQUEST_STATUSES = ["open", "assigned", "accepted", "enroute"] as const;

export type VisitHistoryCursor = {
  createdAt: string;
  id: string;
};

function normalizeHistoryLimit(limit?: number | null) {
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

function mapToPatientVisitSummary(
  request: typeof serviceRequests.$inferSelect,
): PatientVisitSummary {
  return PatientVisitSummarySchema.parse({
    id: request.id,
    status: request.status,
    address: request.address,
    assignedNurseUserId: request.assignedNurseUserId,
    createdAt: request.createdAt.toISOString(),
    requestType: request.requestType,
    scheduledFor: request.scheduledFor?.toISOString() ?? null,
    careType: request.careType ?? null,
  });
}

export async function getPatientVisitProjection(
  db: DbClient,
  input: {
    actorUserId: string;
    historyLimit?: number | null;
    historyCursor?: VisitHistoryCursor | null;
  },
): Promise<{
  activeVisit: PatientVisitSummary | null;
  recentVisits: GetPatientVisitsResponse;
  nextHistoryCursor: VisitHistoryCursor | null;
}> {
  const { actorUserId, historyCursor } = input;
  const historyLimit = normalizeHistoryLimit(input.historyLimit);

  const [activeVisitRow] = await db
    .select()
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.patientUserId, actorUserId),
        or(
          ...ACTIVE_PATIENT_REQUEST_STATUSES.map((status) => eq(serviceRequests.status, status)),
        ),
      ),
    )
    .orderBy(desc(serviceRequests.createdAt), desc(serviceRequests.id))
    .limit(1);

  const activeVisit = activeVisitRow ? mapToPatientVisitSummary(activeVisitRow) : null;
  const cursorCondition = buildHistoryCursorCondition(historyCursor);
  const historyConditions = [
    eq(serviceRequests.patientUserId, actorUserId),
    activeVisitRow ? ne(serviceRequests.id, activeVisitRow.id) : null,
    cursorCondition,
  ].filter(isSqlCondition);

  const historyRows = await db
    .select()
    .from(serviceRequests)
    .where(and(...historyConditions))
    .orderBy(desc(serviceRequests.createdAt), desc(serviceRequests.id))
    .limit(historyLimit + 1);

  const pageRows = historyRows.slice(0, historyLimit);
  const recentVisits = GetPatientVisitsResponseSchema.parse(
    pageRows.map((request) => mapToPatientVisitSummary(request)),
  );
  const lastRow = pageRows.at(-1);
  const nextHistoryCursor =
    historyRows.length > historyLimit && lastRow
      ? {
          createdAt: lastRow.createdAt.toISOString(),
          id: lastRow.id,
        }
      : null;

  return {
    activeVisit,
    recentVisits,
    nextHistoryCursor,
  };
}
