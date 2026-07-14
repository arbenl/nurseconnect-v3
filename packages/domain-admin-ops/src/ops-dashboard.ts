import type {
  AdminActiveRequestQueueItem,
  AdminOpsStatusCounts,
  AdminReassignmentActivityItem,
} from "@nurseconnect/contracts";
import type { DbExecutor } from "@nurseconnect/database";

import { DEFAULT_TRIAGE_SEVERITY_POLICY } from "./triage-severity";

const attentionStatuses = ["submitted", "under_review", "renewal_pending", "suspended"] as const;
const RECENT_FAILURE_WINDOW_HOURS = 24;

type DashboardOpsStatusRow = {
  activeServiceAreas: number | string;
  exceptionQueue: number | string;
  authorizationsWithoutPayout: number | string;
  recentFailedAuthorizations: number | string;
  recentFailedPayouts: number | string;
};

type PaymentFollowUpRow = {
  kind: "authorization_without_payout" | "authorization_failed" | "payout_failed";
  requestId: string;
  createdAt: Date | string;
};

export type AdminDashboardPaymentFollowUpItem = {
  kind: PaymentFollowUpRow["kind"];
  requestId: string;
  createdAt: string;
};

function toCount(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function normalizeDate(value: Date | string) {
  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid timestamp in ops dashboard data: ${String(value)}`);
  }

  return parsed.toISOString();
}

function isQueueItemStale(item: AdminActiveRequestQueueItem, generatedAt: string) {
  const generatedAtMs = Date.parse(generatedAt);
  const lastEventAtMs = Date.parse(item.lastEventAt);

  if (Number.isNaN(generatedAtMs) || Number.isNaN(lastEventAtMs)) {
    return false;
  }

  const staleBeforeMs =
    generatedAtMs -
    DEFAULT_TRIAGE_SEVERITY_POLICY.staleEventThresholdMinutes * 60_000;

  return lastEventAtMs < staleBeforeMs;
}

export function summarizeOpsDashboard<
  TCredentialCounts extends {
    total: number;
    available: number;
    needsAttention: number;
    submitted: number;
    under_review: number;
    verified: number;
    suspended: number;
    expired: number;
    renewal_pending: number;
  },
  TPendingCredentialItem,
>(input: {
  queueItems: AdminActiveRequestQueueItem[];
  credentialCounts: TCredentialCounts;
  pendingCredentialItems: TPendingCredentialItem[];
  recentActivity: AdminReassignmentActivityItem[];
  opsStatus: AdminOpsStatusCounts;
  paymentFollowUpItems: AdminDashboardPaymentFollowUpItem[];
  generatedAt: string;
}) {
  const requestCounts = {
    total: input.queueItems.length,
    critical: input.queueItems.filter((item) => item.severityBand === "critical").length,
    high: input.queueItems.filter((item) => item.severityBand === "high").length,
    unassigned: input.queueItems.filter((item) => item.assignedNurse === "unassigned").length,
    assigned: input.queueItems.filter((item) => item.assignedNurse === "assigned").length,
  };
  const staleAssigned = input.queueItems.filter(
    (item) => item.status === "assigned" && isQueueItemStale(item, input.generatedAt),
  ).length;
  const staleEnroute = input.queueItems.filter(
    (item) => item.status === "enroute" && isQueueItemStale(item, input.generatedAt),
  ).length;
  const opsStatus: AdminOpsStatusCounts = {
    ...input.opsStatus,
    requests: {
      ...input.opsStatus.requests,
      unassigned: requestCounts.unassigned,
      staleAssigned,
      staleEnroute,
    },
  };

  return {
    generatedAt: input.generatedAt,
    requestCounts,
    opsStatus,
    credentialCounts: input.credentialCounts,
    recentHotRequests: input.queueItems.slice(0, 5),
    pendingCredentialItems: input.pendingCredentialItems,
    recentActivity: input.recentActivity,
    paymentFollowUpItems: input.paymentFollowUpItems,
  };
}
export async function getAdminOpsDashboard(db: DbExecutor) {
  const generatedAt = new Date().toISOString();
  const recentSince = new Date(
    Date.parse(generatedAt) - RECENT_FAILURE_WINDOW_HOURS * 60 * 60_000,
  );
  const [
    { getAdminActiveRequestQueue },
    { getNurseCredentialCounts, listNurseCredentials },
    { getAdminReassignmentActivityFeed },
    { getLaunchNurseSupplySummary },
  ] =
    await Promise.all([
      import("./active-request-queue"),
      import("@nurseconnect/domain-nurse"),
      import("./reassignment-activity-feed"),
      import("./ops-status"),
    ]);

  const [
    queue,
    credentialCounts,
    nurseSupply,
    pendingCredentialItems,
    activity,
    dashboardStatusRows,
    paymentFollowUpRows,
  ] = await Promise.all([
    getAdminActiveRequestQueue(db, { limit: 200 }),
    getNurseCredentialCounts(db),
    getLaunchNurseSupplySummary(db, new Date(generatedAt)),
    listNurseCredentials({ statuses: Array.from(attentionStatuses), limit: 5 }, db),
    getAdminReassignmentActivityFeed(db, 6),
    getDashboardOpsStatusRows(db, recentSince),
    getPaymentFollowUpRows(db, recentSince),
  ]);
  const dashboardStatus = dashboardStatusRows.rows[0];
  const opsStatus: AdminOpsStatusCounts = {
    generatedAt,
    serviceAreas: {
      active: toCount(dashboardStatus?.activeServiceAreas),
    },
    nurseSupply,
    requests: {
      unassigned: 0,
      staleAssigned: 0,
      staleEnroute: 0,
      exceptionQueue: toCount(dashboardStatus?.exceptionQueue),
    },
    payments: {
      authorizationsWithoutPayout: toCount(
        dashboardStatus?.authorizationsWithoutPayout,
      ),
      recentFailedAuthorizations: toCount(
        dashboardStatus?.recentFailedAuthorizations,
      ),
      recentFailedPayouts: toCount(dashboardStatus?.recentFailedPayouts),
    },
  };
  const paymentFollowUpItems = paymentFollowUpRows.rows.map((row) => ({
    kind: row.kind,
    requestId: row.requestId,
    createdAt: normalizeDate(row.createdAt),
  }));

  return summarizeOpsDashboard({
    queueItems: queue.items,
    credentialCounts,
    pendingCredentialItems,
    recentActivity: activity.items,
    opsStatus,
    paymentFollowUpItems,
    generatedAt,
  });
}

async function getDashboardOpsStatusRows(db: DbExecutor, recentSince: Date) {
  const { sql } = await import("@nurseconnect/database");

  return db.execute<DashboardOpsStatusRow>(sql`
    SELECT
      (
        SELECT COUNT(*)
        FROM service_areas sa
        WHERE sa.status = 'active'::service_area_status
      ) AS "activeServiceAreas",
      (
        SELECT COUNT(*)
        FROM service_requests sr
        WHERE sr.status IN (
          'needs_review'::service_request_status,
          'declined'::service_request_status,
          'unfulfilled'::service_request_status
        )
      ) AS "exceptionQueue",
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
  `);
}

async function getPaymentFollowUpRows(db: DbExecutor, recentSince: Date) {
  const { sql } = await import("@nurseconnect/database");

  return db.execute<PaymentFollowUpRow>(sql`
    WITH authorization_gaps AS (
      SELECT
        'authorization_without_payout'::text AS kind,
        pa.request_id,
        pa.created_at AS created_at
      FROM payment_authorizations pa
      LEFT JOIN nurse_payouts np ON np.request_id = pa.request_id
      WHERE pa.status IN (
        'authorized'::payment_authorization_status,
        'captured'::payment_authorization_status
      )
        AND np.id IS NULL
      ORDER BY pa.created_at DESC
      LIMIT 3
    ),
    recent_failures AS (
      SELECT
        CASE
          WHEN aal.action = 'payment.authorization.failed' THEN 'authorization_failed'
          ELSE 'payout_failed'
        END AS kind,
        aal.target_entity_id AS request_id,
        aal.created_at
      FROM admin_audit_logs aal
      WHERE aal.action IN ('payment.authorization.failed', 'payout.failed')
        AND aal.created_at >= ${recentSince}
      ORDER BY aal.created_at DESC
      LIMIT 3
    )
    SELECT kind, request_id AS "requestId", created_at AS "createdAt"
    FROM (
      SELECT * FROM authorization_gaps
      UNION ALL
      SELECT * FROM recent_failures
    ) payment_follow_up
    ORDER BY created_at DESC
    LIMIT 5
  `);
}
