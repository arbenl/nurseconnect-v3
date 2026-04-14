import Link from "next/link";

import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { Badge } from "@/components/ui/badge";
import { requirePortalAccessOrRedirect } from "@/server/auth";
import { getAdminActiveRequestQueue } from "@/server/requests/admin-active-queue";

function severityClassName(band: "critical" | "high" | "medium" | "low") {
  switch (band) {
    case "critical":
      return "border-red-200 bg-red-50 text-red-700";
    case "high":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "medium":
      return "border-lime-200 bg-lime-50 text-lime-700";
    default:
      return "border-sky-200 bg-sky-50 text-sky-700";
  }
}

export default async function AdminRequestsPage() {
  await requirePortalAccessOrRedirect({ portal: "admin", currentPath: "/admin/requests" });
  const queue = await getAdminActiveRequestQueue({ limit: 200 });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Active Requests Queue</h1>
        <p className="text-sm text-slate-600">
          Read-only triage feed with PHI-safe request context and severity ordering.
        </p>
      </div>

      <AdminSectionCard
        title="Queue snapshot"
        description={`Generated at ${new Date(queue.generatedAt).toLocaleString()}`}
        contentClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead className="bg-slate-100/80 text-slate-600">
            <tr>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Request</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Status</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Severity</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Wait (min)</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Last Event</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Assigned</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Location Hint</th>
            </tr>
          </thead>
          <tbody>
            {queue.items.map((item) => {
              return (
                <tr key={item.requestId} className="bg-white transition odd:bg-slate-50/60 hover:bg-sky-50/40">
                  <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs text-slate-900">
                    <Link
                      href={`/admin/requests/${item.requestId}`}
                      className="underline decoration-slate-300 underline-offset-4 hover:decoration-sky-400"
                    >
                      {item.requestId}
                    </Link>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 capitalize text-slate-700">
                    {item.status}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={severityClassName(item.severityBand)}>
                      {item.severityBand}
                      </Badge>
                      <span className="text-slate-600">{item.severityScore}</span>
                    </div>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-slate-700">{item.waitMinutes}</td>
                  <td className="border-b border-slate-100 px-4 py-3 text-slate-700">
                    {new Date(item.lastEventAt).toLocaleString()}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 capitalize text-slate-700">
                    {item.assignedNurse}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs text-slate-600">
                    {item.locationHint}
                  </td>
                </tr>
              );
            })}
            {queue.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                  No active requests.
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
