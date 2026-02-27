import {
  type AdminReassignmentActivityItem,
  type AdminReassignmentActivityResponse,
  AdminReassignmentActivityResponseSchema,
} from "@nurseconnect/contracts";
import { and, db, eq, schema } from "@nurseconnect/database";
import { z } from "zod";

const { adminAuditLogs, requestEvents } = schema;

const MIN_LIMIT = 1;
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;
const uuidSchema = z.string().uuid();

function toUuidOrNull(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const parsed = uuidSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function toPositiveInt(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && /^[0-9]+$/.test(value)) {
    return Number(value);
  }
  throw new Error(`Invalid activity item id: ${String(value)}`);
}

function toMetadata(value: unknown): {
  previousNurseUserId: string | null;
  newNurseUserId: string | null;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      previousNurseUserId: null,
      newNurseUserId: null,
    };
  }

  const details = value as Record<string, unknown>;
  return {
    previousNurseUserId: toUuidOrNull(details.previousNurseUserId),
    newNurseUserId: toUuidOrNull(details.newNurseUserId) ?? toUuidOrNull(details.nurseUserId),
  };
}

export async function getAdminReassignmentActivityFeed(limit = DEFAULT_LIMIT): Promise<AdminReassignmentActivityResponse> {
  const normalizedLimit = Math.min(Math.max(limit, MIN_LIMIT), MAX_LIMIT);

  const [eventRows, auditRows] = await Promise.all([
    db.query.requestEvents.findMany({
      where: eq(requestEvents.type, "request_reassigned"),
      orderBy: (events, { desc: orderDesc }) => [orderDesc(events.createdAt), orderDesc(events.id)],
      limit: normalizedLimit,
    }),
    db.query.adminAuditLogs.findMany({
      where: and(
        eq(adminAuditLogs.action, "request.reassigned"),
        eq(adminAuditLogs.targetEntityType, "request"),
      ),
      orderBy: (audits, { desc: orderDesc }) => [orderDesc(audits.createdAt), orderDesc(audits.id)],
      limit: normalizedLimit,
    }),
  ]);

  const eventItems: AdminReassignmentActivityItem[] = eventRows.map((eventRow) => ({
    source: "request-event",
    id: toPositiveInt(eventRow.id),
    requestId: eventRow.requestId,
    actorUserId: eventRow.actorUserId,
    fromStatus: eventRow.fromStatus,
    toStatus: eventRow.toStatus,
    metadata: toMetadata(eventRow.meta),
    createdAt: eventRow.createdAt.toISOString(),
  }));

  const auditItems: AdminReassignmentActivityItem[] = auditRows.map((auditRow) => ({
    source: "admin-audit",
    id: toPositiveInt(auditRow.id),
    action: "request.reassigned",
    requestId: auditRow.targetEntityId,
    actorUserId: auditRow.actorUserId,
    metadata: toMetadata(auditRow.details),
    createdAt: auditRow.createdAt.toISOString(),
  }));

  const items = [...eventItems, ...auditItems]
    .sort((left, right) => {
      const timeDiff = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return right.id - left.id;
    })
    .slice(0, normalizedLimit);

  return AdminReassignmentActivityResponseSchema.parse({
    generatedAt: new Date().toISOString(),
    items,
  });
}
