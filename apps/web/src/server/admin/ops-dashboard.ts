import { getAdminReassignmentActivityFeed } from "@/server/admin/activity-feed";
import { listNurseCredentials } from "@/server/admin/nurse-credentials";
import { getAdminActiveRequestQueue } from "@/server/requests/admin-active-queue";

const attentionStatuses = new Set(["submitted", "under_review", "renewal_pending", "suspended"]);

export async function getAdminOpsDashboard() {
  const [queue, credentials, activity] = await Promise.all([
    getAdminActiveRequestQueue({ limit: 200 }),
    listNurseCredentials(),
    getAdminReassignmentActivityFeed(6),
  ]);

  const requestCounts = {
    total: queue.items.length,
    critical: queue.items.filter((item) => item.severityBand === "critical").length,
    high: queue.items.filter((item) => item.severityBand === "high").length,
    unassigned: queue.items.filter((item) => item.assignedNurse === "unassigned").length,
    assigned: queue.items.filter((item) => item.assignedNurse === "assigned").length,
  };

  const credentialCounts = credentials.reduce(
    (acc, item) => {
      acc.total += 1;
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      if (item.status === "verified") {
        acc.verified += 1;
      }
      if (item.isAvailable) {
        acc.available += 1;
      }
      if (attentionStatuses.has(item.status)) {
        acc.needsAttention += 1;
      }
      return acc;
    },
    {
      total: 0,
      verified: 0,
      available: 0,
      needsAttention: 0,
      draft: 0,
      submitted: 0,
      under_review: 0,
      rejected: 0,
      suspended: 0,
      expired: 0,
      renewal_pending: 0,
    },
  );

  return {
    generatedAt: new Date().toISOString(),
    requestCounts,
    credentialCounts,
    recentHotRequests: queue.items.slice(0, 5),
    pendingCredentialItems: credentials
      .filter((item) => attentionStatuses.has(item.status))
      .slice(0, 5),
    recentActivity: activity.items,
  };
}
