import type { AdminOpsStatusCounts } from "@nurseconnect/contracts";
import { db, sql } from "@nurseconnect/database";
import { getVerifiedAndAvailableNurseCount } from "@nurseconnect/domain-nurse";

import { DEFAULT_TRIAGE_SEVERITY_POLICY } from "./triage-severity";

const RECENT_FAILURE_WINDOW_HOURS = 24;

type ServiceAreaCountRow = {
  active: number | string;
};

type RequestStatusCountRow = {
  unassigned: number | string;
  staleAssigned: number | string;
  staleEnroute: number | string;
  exceptionQueue: number | string;
};

type PaymentStatusCountRow = {
  authorizationsWithoutPayout: number | string;
  recentFailedAuthorizations: number | string;
  recentFailedPayouts: number | string;
};

export type GetAdminOpsStatusOptions = {
  now?: Date;
  recentFailureWindowHours?: number;
};

function toCount(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function normalizeRecentWindowHours(value: number | undefined) {
  if (!value || !Number.isFinite(value)) {
    return RECENT_FAILURE_WINDOW_HOURS;
  }
  return Math.max(1, Math.min(168, Math.trunc(value)));
}

export async function getAdminOpsStatus(
  options: GetAdminOpsStatusOptions = {},
): Promise<AdminOpsStatusCounts> {
  const now = options.now ?? new Date();
  const staleBefore = new Date(
    now.getTime() -
      DEFAULT_TRIAGE_SEVERITY_POLICY.staleEventThresholdMinutes * 60_000,
  );
  const recentSince = new Date(
    now.getTime() -
      normalizeRecentWindowHours(options.recentFailureWindowHours) * 60 * 60_000,
  );

  const [serviceAreaRows, verifiedAndAvailable, requestRows, paymentRows] =
    await Promise.all([
      db.execute<ServiceAreaCountRow>(sql`
        SELECT COUNT(*) AS active
        FROM service_areas
        WHERE status = 'active'::service_area_status
      `),
      getVerifiedAndAvailableNurseCount(),
      db.execute<RequestStatusCountRow>(sql`
        WITH latest_request_events AS (
          SELECT request_id, MAX(created_at) AS last_event_at
          FROM service_request_events
          GROUP BY request_id
        )
        SELECT
          COUNT(*) FILTER (
            WHERE sr.status IN (
              'open'::service_request_status,
              'assigned'::service_request_status,
              'accepted'::service_request_status,
              'enroute'::service_request_status
            )
              AND sr.assigned_nurse_user_id IS NULL
          ) AS "unassigned",
          COUNT(*) FILTER (
            WHERE sr.status = 'assigned'::service_request_status
              AND COALESCE(lre.last_event_at, sr.created_at) < ${staleBefore}
          ) AS "staleAssigned",
          COUNT(*) FILTER (
            WHERE sr.status = 'enroute'::service_request_status
              AND COALESCE(lre.last_event_at, sr.created_at) < ${staleBefore}
          ) AS "staleEnroute",
          COUNT(*) FILTER (
            WHERE sr.status IN (
              'needs_review'::service_request_status,
              'declined'::service_request_status,
              'unfulfilled'::service_request_status
            )
          ) AS "exceptionQueue"
        FROM service_requests sr
        LEFT JOIN latest_request_events lre ON lre.request_id = sr.id
      `),
      db.execute<PaymentStatusCountRow>(sql`
        SELECT
          (
            SELECT COUNT(*)
            FROM payment_authorizations pa
            LEFT JOIN nurse_payouts np ON np.request_id = pa.request_id
            WHERE pa.status IN (
              'authorized'::payment_authorization_status,
              'captured'::payment_authorization_status
            )
              AND np.id IS NULL
          ) AS "authorizationsWithoutPayout",
          (
            SELECT COUNT(*)
            FROM admin_audit_logs aal
            WHERE aal.action = 'payment.authorization.failed'
              AND aal.created_at >= ${recentSince}
          ) AS "recentFailedAuthorizations",
          (
            SELECT COUNT(*)
            FROM admin_audit_logs aal
            WHERE aal.action = 'payout.failed'
              AND aal.created_at >= ${recentSince}
          ) AS "recentFailedPayouts"
      `),
    ]);

  const serviceAreaCounts = serviceAreaRows.rows[0];
  const requestCounts = requestRows.rows[0];
  const paymentCounts = paymentRows.rows[0];

  return {
    generatedAt: now.toISOString(),
    serviceAreas: {
      active: toCount(serviceAreaCounts?.active),
    },
    nurseSupply: {
      verifiedAndAvailable,
    },
    requests: {
      unassigned: toCount(requestCounts?.unassigned),
      staleAssigned: toCount(requestCounts?.staleAssigned),
      staleEnroute: toCount(requestCounts?.staleEnroute),
      exceptionQueue: toCount(requestCounts?.exceptionQueue),
    },
    payments: {
      authorizationsWithoutPayout: toCount(
        paymentCounts?.authorizationsWithoutPayout,
      ),
      recentFailedAuthorizations: toCount(paymentCounts?.recentFailedAuthorizations),
      recentFailedPayouts: toCount(paymentCounts?.recentFailedPayouts),
    },
  };
}
