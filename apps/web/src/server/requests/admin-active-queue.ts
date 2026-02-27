import {
  ActiveRequestStatusInfo,
  AdminActiveRequestQueueResponseSchema,
  type ActiveRequestStatus,
  type AdminActiveRequestQueueResponse,
} from "@nurseconnect/contracts";
import { db, sql } from "@nurseconnect/database";

import {
  ACTIVE_REQUEST_STATUSES,
  DEFAULT_TRIAGE_SEVERITY_POLICY,
  buildActiveQueueItem,
  sortQueueItems,
  type TriageSeverityPolicy,
} from "./triage-severity";

type ActiveQueueDbRow = {
  requestId: string;
  status: string;
  assignedNurseUserId: string | null;
  createdAt: Date | string;
  lastEventAt: Date | string;
  lat: string;
  lng: string;
};

export type GetAdminActiveRequestQueueOptions = {
  now?: Date;
  limit?: number;
  policy?: TriageSeverityPolicy;
};

function normalizeLimit(limit: number | undefined) {
  if (!limit || !Number.isFinite(limit)) {
    return 200;
  }
  return Math.max(1, Math.min(500, Math.trunc(limit)));
}

function toIsoString(value: Date | string) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid timestamp in active queue row");
  }
  return parsed.toISOString();
}

export async function getAdminActiveRequestQueue(
  options: GetAdminActiveRequestQueueOptions = {},
): Promise<AdminActiveRequestQueueResponse> {
  const now = options.now ?? new Date();
  const limit = normalizeLimit(options.limit);
  const policy = options.policy ?? DEFAULT_TRIAGE_SEVERITY_POLICY;

  const rows = await db.execute<ActiveQueueDbRow>(sql`
    SELECT
      sr.id AS "requestId",
      sr.status::text AS status,
      sr.assigned_nurse_user_id AS "assignedNurseUserId",
      sr.created_at AS "createdAt",
      COALESCE(MAX(sre.created_at), sr.created_at) AS "lastEventAt",
      sr.lat::text AS lat,
      sr.lng::text AS lng
    FROM service_requests sr
    LEFT JOIN service_request_events sre ON sre.request_id = sr.id
    WHERE sr.status::text IN (
      ${sql.join(ACTIVE_REQUEST_STATUSES.map((status) => sql`${status}`), sql`, `)}
    )
    GROUP BY sr.id, sr.status, sr.assigned_nurse_user_id, sr.created_at, sr.lat, sr.lng
    LIMIT ${limit}
  `);

  const items = sortQueueItems(
    rows.rows.map((row) => {
      const parsedStatus = ActiveRequestStatusInfo.parse(row.status) as ActiveRequestStatus;
      return buildActiveQueueItem(
        {
          requestId: row.requestId,
          status: parsedStatus,
          assignedNurseUserId: row.assignedNurseUserId,
          createdAt: toIsoString(row.createdAt),
          lastEventAt: toIsoString(row.lastEventAt),
          lat: row.lat,
          lng: row.lng,
        },
        policy,
        now,
      );
    }),
  );

  return AdminActiveRequestQueueResponseSchema.parse({
    generatedAt: now.toISOString(),
    items,
  });
}
