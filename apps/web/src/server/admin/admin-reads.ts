import {
  type AdminNurse,
  type AdminNursesListQuery,
  type AdminNursesListResponse,
  type AdminRequestDetail,
  type AdminRequestListResponse,
  type AdminRequestsListQuery,
  type AdminUser,
  type AdminUsersListQuery,
  type AdminUsersListResponse,
  AdminRequestDetailSchema,
} from "@nurseconnect/contracts";
import { and, desc, eq, lt, or } from "@nurseconnect/database";
import { db, schema } from "@nurseconnect/database";

import { getRequestEventsForUser } from "@/server/requests/request-events";

const { nurses, serviceRequests, users } = schema;

type AdminCursor = {
  createdAt: string;
  id: string;
};
type AdminCursorField = Parameters<typeof lt>[0];

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export class AdminRequestNotFoundError extends Error {
  constructor(message = "Request not found") {
    super(message);
    this.name = "AdminRequestNotFoundError";
  }
}

function normalizeLimit(limit: number | undefined) {
  const safeLimit = limit ?? DEFAULT_LIMIT;
  if (!Number.isFinite(safeLimit) || safeLimit <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(safeLimit, MAX_LIMIT);
}

function decodeAdminCursor(cursor?: string): AdminCursor | null {
  if (!cursor) {
    return null;
  }

  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const [createdAt, id] = decoded.split("|");
    if (!createdAt || !id) return null;

    const parsedDate = new Date(createdAt);
    if (Number.isNaN(parsedDate.getTime())) return null;

    return { createdAt, id };
  } catch {
    return null;
  }
}

function makeCursor(item: { createdAt: Date; id: string }) {
  return Buffer.from(`${item.createdAt.toISOString()}|${item.id}`).toString("base64url");
}

type AdminWhereCondition = ReturnType<typeof and> | ReturnType<typeof or>;

function applyPagination<T extends { createdAt: Date; id: string }>(rows: T[], limit: number) {
  const pageSize = normalizeLimit(limit);
  const hasNextPage = rows.length > pageSize;
  const items = rows.slice(0, pageSize);

  const nextCursor = hasNextPage && items.at(-1) ? makeCursor(items.at(-1)!) : null;
  return { items, nextCursor };
}

function getCursorWhereClause(
  createdAtField: AdminCursorField,
  idField: AdminCursorField,
  cursor: string | undefined,
): AdminWhereCondition | undefined {
  const decoded = decodeAdminCursor(cursor);
  if (!decoded) return undefined;

  const parsedDate = new Date(decoded.createdAt);
  return or(
    lt(createdAtField, parsedDate),
    and(eq(createdAtField, parsedDate), lt(idField, decoded.id)),
  );
}

export async function getAdminUsers(input: AdminUsersListQuery): Promise<AdminUsersListResponse> {
  const limit = normalizeLimit(input.limit);
  const cursorWhere = getCursorWhereClause(users.createdAt, users.id, input.cursor);
  const baseQuery = db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      authId: users.authId,
      firebaseUid: users.firebaseUid,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(limit + 1);

  const rows = await (cursorWhere ? baseQuery.where(cursorWhere) : baseQuery);

  const { items: rowItems, nextCursor } = applyPagination(rows, limit);

  const items: AdminUser[] = rowItems.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: (row.role as AdminUser["role"]),
    authId: row.authId ?? null,
    firebaseUid: row.firebaseUid ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));

  return { items, nextCursor };
}

export async function getAdminNurses(input: AdminNursesListQuery): Promise<AdminNursesListResponse> {
  const limit = normalizeLimit(input.limit);
  const cursorWhere = getCursorWhereClause(nurses.createdAt, nurses.id, input.cursor);
  const roleWhere = eq(users.role, "nurse") as AdminWhereCondition;
  const whereClause = cursorWhere ? and(roleWhere, cursorWhere) : roleWhere;

  const rows = await db
    .select({
      id: nurses.id,
      userId: nurses.userId,
      email: users.email,
      name: users.name,
      status: nurses.status,
      licenseNumber: nurses.licenseNumber,
      specialization: nurses.specialization,
      phone: nurses.phone,
      isAvailable: nurses.isAvailable,
      createdAt: nurses.createdAt,
      updatedAt: nurses.updatedAt,
    })
    .from(nurses)
    .innerJoin(users, eq(users.id, nurses.userId))
    .where(whereClause)
    .orderBy(desc(nurses.createdAt), desc(nurses.id))
    .limit(limit + 1);

  const { items: rowItems, nextCursor } = applyPagination(rows, limit);

  const items: AdminNurse[] = rowItems.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));

  return { items, nextCursor };
}

export async function getAdminRequests(input: AdminRequestsListQuery): Promise<AdminRequestListResponse> {
  const limit = normalizeLimit(input.limit);
  const cursorWhere = getCursorWhereClause(serviceRequests.createdAt, serviceRequests.id, input.cursor);
  const statusWhere = input.status
    ? (eq(serviceRequests.status, input.status) as AdminWhereCondition)
    : undefined;
  const whereClause = statusWhere && cursorWhere ? and(statusWhere, cursorWhere) : statusWhere ?? cursorWhere;

  const rows = await db
    .select({
      id: serviceRequests.id,
      patientUserId: serviceRequests.patientUserId,
      assignedNurseUserId: serviceRequests.assignedNurseUserId,
      status: serviceRequests.status,
      address: serviceRequests.address,
      lat: serviceRequests.lat,
      lng: serviceRequests.lng,
      assignedAt: serviceRequests.assignedAt,
      acceptedAt: serviceRequests.acceptedAt,
      enrouteAt: serviceRequests.enrouteAt,
      completedAt: serviceRequests.completedAt,
      canceledAt: serviceRequests.canceledAt,
      rejectedAt: serviceRequests.rejectedAt,
      createdAt: serviceRequests.createdAt,
      updatedAt: serviceRequests.updatedAt,
    })
    .from(serviceRequests)
    .where(whereClause)
    .orderBy(desc(serviceRequests.createdAt), desc(serviceRequests.id))
    .limit(limit + 1);

  const { items: rowItems, nextCursor } = applyPagination(rows, limit);

  return {
    items: rowItems.map((row) => ({
      ...row,
      assignedAt: row.assignedAt ? row.assignedAt.toISOString() : null,
      acceptedAt: row.acceptedAt ? row.acceptedAt.toISOString() : null,
      enrouteAt: row.enrouteAt ? row.enrouteAt.toISOString() : null,
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      canceledAt: row.canceledAt ? row.canceledAt.toISOString() : null,
      rejectedAt: row.rejectedAt ? row.rejectedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      lat: row.lat,
      lng: row.lng,
      status: row.status,
    })),
    nextCursor,
  };
}

export async function getAdminRequestDetail(input: { requestId: string; actorUserId: string }): Promise<AdminRequestDetail> {
  const rows = await db
    .select({
      id: serviceRequests.id,
      patientUserId: serviceRequests.patientUserId,
      assignedNurseUserId: serviceRequests.assignedNurseUserId,
      status: serviceRequests.status,
      address: serviceRequests.address,
      lat: serviceRequests.lat,
      lng: serviceRequests.lng,
      assignedAt: serviceRequests.assignedAt,
      acceptedAt: serviceRequests.acceptedAt,
      enrouteAt: serviceRequests.enrouteAt,
      completedAt: serviceRequests.completedAt,
      canceledAt: serviceRequests.canceledAt,
      rejectedAt: serviceRequests.rejectedAt,
      createdAt: serviceRequests.createdAt,
      updatedAt: serviceRequests.updatedAt,
    })
    .from(serviceRequests)
    .where(eq(serviceRequests.id, input.requestId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new AdminRequestNotFoundError();
  }

  const events = await getRequestEventsForUser({
    requestId: input.requestId,
    actorUserId: input.actorUserId,
    actorRole: "admin",
  });

  const detail = {
    request: {
      id: row.id,
      patientUserId: row.patientUserId,
      assignedNurseUserId: row.assignedNurseUserId,
      status: row.status,
      address: row.address,
      lat: row.lat,
      lng: row.lng,
      assignedAt: row.assignedAt ? row.assignedAt.toISOString() : null,
      acceptedAt: row.acceptedAt ? row.acceptedAt.toISOString() : null,
      enrouteAt: row.enrouteAt ? row.enrouteAt.toISOString() : null,
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      canceledAt: row.canceledAt ? row.canceledAt.toISOString() : null,
      rejectedAt: row.rejectedAt ? row.rejectedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
    events,
  };

  return AdminRequestDetailSchema.parse(detail);
}
