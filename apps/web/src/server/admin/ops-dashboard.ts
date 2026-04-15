import { getNurseCredentialCounts, listNurseCredentials } from "@nurseconnect/domain-nurse";

import { getAdminReassignmentActivityFeed } from "@/server/admin/activity-feed";
import { getAdminActiveRequestQueue } from "@/server/requests/admin-active-queue";

const attentionStatuses = new Set(["submitted", "under_review", "renewal_pending", "suspended"]);

export async function getAdminOpsDashboard() {
  const [queue, credentialCounts, pendingCredentialItems, activity] = await Promise.all([
    getAdminActiveRequestQueue({ limit: 200 }),
    getNurseCredentialCounts(),
    listNurseCredentials({ statuses: Array.from(attentionStatuses), limit: 5 }),
    getAdminReassignmentActivityFeed(6),
  ]);

  const requestCounts = {
    total: queue.items.length,
    critical: queue.items.filter((item) => item.severityBand === "critical").length,
    high: queue.items.filter((item) => item.severityBand === "high").length,
    unassigned: queue.items.filter((item) => item.assignedNurse === "unassigned").length,
    assigned: queue.items.filter((item) => item.assignedNurse === "assigned").length,
  };

  return {
    generatedAt: new Date().toISOString(),
    requestCounts,
    credentialCounts,
    recentHotRequests: queue.items.slice(0, 5),
    pendingCredentialItems,
    recentActivity: activity.items,
  };
}
