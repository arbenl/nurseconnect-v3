import { type AdminActiveRequestQueueItem } from "@nurseconnect/contracts";
import Link from "next/link";

import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { Badge } from "@/components/ui/badge";
import { requirePortalAccessOrRedirect } from "@/server/auth";
import { getAdminActiveRequestQueue } from "@/server/requests/admin-active-queue";

type PageProps = {
  searchParams?: {
    status?: string;
    severity?: string;
    assignment?: string;
  };
};

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

function buildHref(filters: {
  status?: string;
  severity?: string;
  assignment?: string;
}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.assignment) params.set("assignment", filters.assignment);
  const query = params.toString();
  return query ? `/admin/requests?${query}` : "/admin/requests";
}

function filterQueue(
  items: AdminActiveRequestQueueItem[],
  filters: {
    status?: string;
    severity?: string;
    assignment?: string;
  },
) {
  return items.filter((item) => {
    if (filters.status && item.status !== filters.status) {
      return false;
    }
    if (filters.severity && item.severityBand !== filters.severity) {
      return false;
    }
    if (filters.assignment && item.assignedNurse !== filters.assignment) {
      return false;
    }
    return true;
  });
}

export default async function AdminRequestsPage({ searchParams }: PageProps) {
  await requirePortalAccessOrRedirect({ portal: "admin", currentPath: "/admin/requests" });
  const queue = await getAdminActiveRequestQueue({ limit: 200 });
  const filters = {
    status: searchParams?.status,
    severity: searchParams?.severity,
    assignment: searchParams?.assignment,
  };
  const filteredItems = filterQueue(queue.items, filters);

  const statusCounts = {
    open: queue.items.filter((item) => item.status === "open").length,
    assigned: queue.items.filter((item) => item.status === "assigned").length,
    accepted: queue.items.filter((item) => item.status === "accepted").length,
    enroute: queue.items.filter((item) => item.status === "enroute").length,
  };

  const assignmentCounts = {
    unassigned: queue.items.filter((item) => item.assignedNurse === "unassigned").length,
    assigned: queue.items.filter((item) => item.assignedNurse === "assigned").length,
  };

  const severityCounts = {
    critical: queue.items.filter((item) => item.severityBand === "critical").length,
    high: queue.items.filter((item) => item.severityBand === "high").length,
    medium: queue.items.filter((item) => item.severityBand === "medium").length,
    low: queue.items.filter((item) => item.severityBand === "low").length,
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Active Requests Queue</h1>
        <p className="text-sm text-slate-600">
          Triage-first request surface with operational filters, intake context, and direct drill-in.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <AdminSectionCard
          title="Status mix"
          description="Where work is piling up in the current request lifecycle."
        >
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="capitalize">{statusCounts.open} open</Badge>
            <Badge variant="outline" className="capitalize">{statusCounts.assigned} assigned</Badge>
            <Badge variant="outline" className="capitalize">{statusCounts.accepted} accepted</Badge>
            <Badge variant="outline" className="capitalize">{statusCounts.enroute} enroute</Badge>
          </div>
        </AdminSectionCard>
        <AdminSectionCard
          title="Assignment pressure"
          description="Requests still waiting for a nurse versus already staffed."
        >
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
              {assignmentCounts.unassigned} unassigned
            </Badge>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              {assignmentCounts.assigned} assigned
            </Badge>
          </div>
        </AdminSectionCard>
        <AdminSectionCard
          title="Severity bands"
          description="Fast view of where operator attention should go first."
        >
          <div className="flex flex-wrap gap-2">
            {(["critical", "high", "medium", "low"] as const).map((band) => (
              <Badge key={band} variant="outline" className={severityClassName(band)}>
                {severityCounts[band]} {band}
              </Badge>
            ))}
          </div>
        </AdminSectionCard>
      </div>

      <AdminSectionCard title="Filters" description="Narrow the queue without losing the generated severity ordering.">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "All", href: buildHref({ severity: filters.severity, assignment: filters.assignment }) },
                { label: "Open", href: buildHref({ status: "open", severity: filters.severity, assignment: filters.assignment }) },
                { label: "Assigned", href: buildHref({ status: "assigned", severity: filters.severity, assignment: filters.assignment }) },
                { label: "Accepted", href: buildHref({ status: "accepted", severity: filters.severity, assignment: filters.assignment }) },
                { label: "Enroute", href: buildHref({ status: "enroute", severity: filters.severity, assignment: filters.assignment }) },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition hover:border-sky-300 hover:bg-sky-50"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Severity</div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "All", href: buildHref({ status: filters.status, assignment: filters.assignment }) },
                { label: "Critical", href: buildHref({ status: filters.status, severity: "critical", assignment: filters.assignment }) },
                { label: "High", href: buildHref({ status: filters.status, severity: "high", assignment: filters.assignment }) },
                { label: "Medium", href: buildHref({ status: filters.status, severity: "medium", assignment: filters.assignment }) },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition hover:border-sky-300 hover:bg-sky-50"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assignment</div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "All", href: buildHref({ status: filters.status, severity: filters.severity }) },
                { label: "Unassigned", href: buildHref({ status: filters.status, severity: filters.severity, assignment: "unassigned" }) },
                { label: "Assigned", href: buildHref({ status: filters.status, severity: filters.severity, assignment: "assigned" }) },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition hover:border-sky-300 hover:bg-sky-50"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </AdminSectionCard>

      <AdminSectionCard
        title="Queue snapshot"
        description={`Generated at ${new Date(queue.generatedAt).toLocaleString()} • ${filteredItems.length} visible item(s)`}
        contentClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead className="bg-slate-100/80 text-slate-600">
              <tr>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Request</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Dispatch</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Severity</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Wait</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Last event</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Intake context</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Location hint</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.requestId} className="bg-white transition odd:bg-slate-50/60 hover:bg-sky-50/40">
                  <td className="border-b border-slate-100 px-4 py-3">
                    <Link
                      href={`/admin/requests/${item.requestId}`}
                      className="font-mono text-xs text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-sky-400"
                    >
                      {item.requestId}
                    </Link>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="capitalize">{item.status}</Badge>
                      <Badge
                        variant="outline"
                        className={
                          item.assignedNurse === "unassigned"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        }
                      >
                        {item.assignedNurse}
                      </Badge>
                    </div>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={severityClassName(item.severityBand)}>
                        {item.severityBand}
                      </Badge>
                      <span className="text-slate-600">{item.severityScore}</span>
                    </div>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-slate-700">{item.waitMinutes} min</td>
                  <td className="border-b border-slate-100 px-4 py-3 text-slate-700">
                    {new Date(item.lastEventAt).toLocaleString()}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="capitalize">
                        {item.requestType.replace("_", "-")}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {item.referralSource}
                      </Badge>
                      {item.careType ? (
                        <Badge variant="outline" className="capitalize">
                          {item.careType}
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs text-slate-600">
                    {item.locationHint}
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    No active requests match the current filters.
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
