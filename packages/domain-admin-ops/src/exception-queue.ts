import {
  AdminExceptionQueueResponseSchema,
  ExceptionRequestStatusInfo,
  type AdminExceptionQueueResponse,
  type ExceptionRequestStatus,
} from "@nurseconnect/contracts";
import { db, sql } from "@nurseconnect/database";

import { toLocationHint } from "./triage-severity";

const EXCEPTION_REQUEST_STATUSES: ExceptionRequestStatus[] = [
  "needs_review",
  "declined",
  "unfulfilled",
];

type ExceptionQueueDbRow = {
  requestId: string;
  status: string;
  requestType: "scheduled" | "same_day";
  referralSource: "consumer" | "partner";
  partnerLabel: string | null;
  careType: string | null;
  reason: string | null;
  actorUserId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastEventAt: Date | string;
  lat: string;
  lng: string;
};

export type GetAdminExceptionQueueOptions = {
  now?: Date;
  limit?: number;
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
    throw new Error("Invalid timestamp in exception queue row");
  }
  return parsed.toISOString();
}

function elapsedMinutes(from: Date, to: Date) {
  const deltaMs = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(deltaMs / 60_000));
}

function normalizeReason(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function getAdminExceptionQueue(
  options: GetAdminExceptionQueueOptions = {},
): Promise<AdminExceptionQueueResponse> {
  const now = options.now ?? new Date();
  const limit = normalizeLimit(options.limit);

  const rows = await db.execute<ExceptionQueueDbRow>(sql`
    WITH latest_exception_event AS (
      SELECT DISTINCT ON (sre.request_id)
        sre.request_id,
        sre.actor_user_id AS "actorUserId",
        sre.created_at AS "lastEventAt",
        sre.meta ->> 'reason' AS reason
      FROM service_request_events sre
      WHERE sre.type::text IN (
        'request_needs_review',
        'request_declined',
        'request_unfulfilled'
      )
      ORDER BY sre.request_id, sre.created_at DESC, sre.id DESC
    )
    SELECT
      sr.id AS "requestId",
      sr.status::text AS status,
      sr.request_type AS "requestType",
      sr.referral_source AS "referralSource",
      rp.organization_name AS "partnerLabel",
      sr.care_type AS "careType",
      lee.reason AS reason,
      lee."actorUserId" AS "actorUserId",
      sr.created_at AS "createdAt",
      sr.updated_at AS "updatedAt",
      COALESCE(lee."lastEventAt", sr.updated_at) AS "lastEventAt",
      sr.lat::text AS lat,
      sr.lng::text AS lng
    FROM service_requests sr
    LEFT JOIN latest_exception_event lee ON lee.request_id = sr.id
    LEFT JOIN referral_partners rp ON rp.user_id = sr.referral_partner_id
    WHERE sr.status::text IN (
      ${sql.join(EXCEPTION_REQUEST_STATUSES.map((status) => sql`${status}`), sql`, `)}
    )
    ORDER BY sr.updated_at DESC, sr.id ASC
    LIMIT ${limit}
  `);

  const items = rows.rows.map((row) => {
    const status = ExceptionRequestStatusInfo.parse(row.status);
    const createdAt = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);

    return {
      requestId: row.requestId,
      status,
      reason: normalizeReason(row.reason),
      waitMinutes: elapsedMinutes(createdAt, now),
      requestType: row.requestType,
      referralSource: row.referralSource,
      partnerLabel: row.partnerLabel,
      careType: row.careType,
      locationHint: toLocationHint(row.lat, row.lng, 2),
      actorUserId: row.actorUserId,
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
      lastEventAt: toIsoString(row.lastEventAt),
    };
  });

  return AdminExceptionQueueResponseSchema.parse({
    generatedAt: now.toISOString(),
    items,
  });
}
