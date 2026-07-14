import type { AdminOpsStatusCounts } from "@nurseconnect/contracts";
import { sql, type DbExecutor } from "@nurseconnect/database";

import {
  LAUNCH_MINIMUM_VERIFIED_AVAILABLE_NURSES,
  summarizeLaunchNurseSupply,
} from "./launch-supply-threshold";
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

type LaunchNurseSupplyRow = {
  verifiedAndAvailable: number | string;
  launchServiceAreaCount: number | string;
  launchLowestServiceAreaSupply: number | string | null;
  launchServiceAreasBelowMinimum: number | string;
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

export async function getLaunchNurseSupplySummary(db: DbExecutor, now = new Date()) {
  const rows = await db.execute<LaunchNurseSupplyRow>(sql`
    WITH active_service_areas AS (
      SELECT id
      FROM service_areas
      WHERE status = 'active'::service_area_status
    ),
    eligible_nurse_locations AS (
      SELECT DISTINCT nl.nurse_user_id, nl.service_area_id
      FROM nurse_locations nl
      JOIN active_service_areas asa ON asa.id = nl.service_area_id
      JOIN nurses n ON n.user_id = nl.nurse_user_id
      JOIN users u ON u.id = n.user_id
      WHERE u.role = 'nurse'
        AND n.status = 'verified'::nurse_status
        AND n.is_available = TRUE
        AND (
          n.license_valid_until IS NULL
          OR n.license_valid_until > ${now}
        )
    ),
    service_area_supply AS (
      SELECT
        asa.id,
        COUNT(DISTINCT enl.nurse_user_id) AS eligible_count
      FROM active_service_areas asa
      LEFT JOIN eligible_nurse_locations enl ON enl.service_area_id = asa.id
      GROUP BY asa.id
    )
    SELECT
      (
        SELECT COUNT(DISTINCT nurse_user_id)
        FROM eligible_nurse_locations
      ) AS "verifiedAndAvailable",
      (
        SELECT COUNT(*)
        FROM service_area_supply
      ) AS "launchServiceAreaCount",
      (
        SELECT COALESCE(MIN(eligible_count), 0)
        FROM service_area_supply
      ) AS "launchLowestServiceAreaSupply",
      (
        SELECT COUNT(*)
        FROM service_area_supply
        WHERE eligible_count < ${LAUNCH_MINIMUM_VERIFIED_AVAILABLE_NURSES}
      ) AS "launchServiceAreasBelowMinimum"
  `);
  const row = rows.rows[0];

  return summarizeLaunchNurseSupply({
    verifiedAndAvailable: toCount(row?.verifiedAndAvailable),
    launchServiceAreaCount: toCount(row?.launchServiceAreaCount),
    launchLowestServiceAreaSupply: toCount(row?.launchLowestServiceAreaSupply),
    launchServiceAreasBelowMinimum: toCount(
      row?.launchServiceAreasBelowMinimum,
    ),
  });
}
export async function getAdminOpsStatus(
  db: DbExecutor,
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

  const [serviceAreaRows, nurseSupply, requestRows, paymentRows] =
    await Promise.all([
      db.execute<ServiceAreaCountRow>(sql`
        SELECT COUNT(*) AS active
        FROM service_areas
        WHERE status = 'active'::service_area_status
      `),
      getLaunchNurseSupplySummary(db, now),
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
    nurseSupply,
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
