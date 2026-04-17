import { getAdminReassignmentActivityFeed } from "@nurseconnect/domain-admin-ops";
import Link from "next/link";

import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { Badge } from "@/components/ui/badge";
import { requirePortalAccessOrRedirect } from "@/server/auth";

function shortId(value: string | null) {
  return value ? value.slice(0, 8) : "-";
}

function transitionLabel(previousNurseUserId: string | null, newNurseUserId: string | null) {
  return `${shortId(previousNurseUserId)} -> ${shortId(newNurseUserId)}`;
}

export default async function AdminActivityPage() {
  await requirePortalAccessOrRedirect({ portal: "admin", currentPath: "/admin/activity" });
  const activity = await getAdminReassignmentActivityFeed(200);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Reassignment Activity Feed</h1>
        <p className="text-sm text-slate-600">
          Unified audit timeline for reassignment actions and linked request events.
        </p>
      </div>

      <AdminSectionCard
        title="Activity timeline"
        description={`Generated at ${new Date(activity.generatedAt).toLocaleString()}`}
        contentClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead className="bg-slate-100/80 text-slate-600">
              <tr>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Time</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Source</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Request</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Actor</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Transition</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">State</th>
              </tr>
            </thead>
            <tbody>
              {activity.items.map((item) => (
                <tr key={`${item.source}:${item.id}`} className="bg-white transition odd:bg-slate-50/60 hover:bg-sky-50/40">
                  <td className="border-b border-slate-100 px-4 py-3 text-slate-700">
                    {new Date(item.createdAt).toLocaleString()}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3">
                    <Badge variant="outline">{item.source}</Badge>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs text-slate-900">
                    <Link
                      href={`/admin/requests/${item.requestId}`}
                      className="underline decoration-slate-300 underline-offset-4 hover:decoration-sky-400"
                    >
                      {item.requestId.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs text-slate-700">
                    {shortId(item.actorUserId)}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs text-slate-700">
                    {transitionLabel(item.metadata.previousNurseUserId, item.metadata.newNurseUserId)}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs text-slate-700">
                    {item.source === "request-event"
                      ? `${item.fromStatus ?? "-"} -> ${item.toStatus ?? "-"}`
                      : item.action}
                  </td>
                </tr>
              ))}
              {activity.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                    No reassignment events found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminSectionCard>
    </div>
  );
}
