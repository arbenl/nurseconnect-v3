import type {
  AdminActiveRequestQueueItem,
  AdminReassignmentActivityItem,
} from "@nurseconnect/contracts";

const attentionStatuses = ["submitted", "under_review", "renewal_pending", "suspended"] as const;

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
  generatedAt: string;
}) {
  const requestCounts = {
    total: input.queueItems.length,
    critical: input.queueItems.filter((item) => item.severityBand === "critical").length,
    high: input.queueItems.filter((item) => item.severityBand === "high").length,
    unassigned: input.queueItems.filter((item) => item.assignedNurse === "unassigned").length,
    assigned: input.queueItems.filter((item) => item.assignedNurse === "assigned").length,
  };

  return {
    generatedAt: input.generatedAt,
    requestCounts,
    credentialCounts: input.credentialCounts,
    recentHotRequests: input.queueItems.slice(0, 5),
    pendingCredentialItems: input.pendingCredentialItems,
    recentActivity: input.recentActivity,
  };
}

export async function getAdminOpsDashboard() {
  const [{ getAdminActiveRequestQueue }, { getNurseCredentialCounts, listNurseCredentials }, { getAdminReassignmentActivityFeed }] =
    await Promise.all([
      import("./active-request-queue"),
      import("@nurseconnect/domain-nurse"),
      import("./reassignment-activity-feed"),
    ]);

  const [queue, credentialCounts, pendingCredentialItems, activity] = await Promise.all([
    getAdminActiveRequestQueue({ limit: 200 }),
    getNurseCredentialCounts(),
    listNurseCredentials({ statuses: Array.from(attentionStatuses), limit: 5 }),
    getAdminReassignmentActivityFeed(6),
  ]);

  return summarizeOpsDashboard({
    queueItems: queue.items,
    credentialCounts,
    pendingCredentialItems,
    recentActivity: activity.items,
    generatedAt: new Date().toISOString(),
  });
}
