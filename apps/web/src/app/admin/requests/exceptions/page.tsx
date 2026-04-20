import { type AdminExceptionQueueItem } from "@nurseconnect/contracts";
import { getAdminExceptionQueue } from "@nurseconnect/domain-admin-ops";
import Link from "next/link";

import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { Badge } from "@/components/ui/badge";
import { requirePortalAccessOrRedirect } from "@/server/auth";

function statusClassName(status: AdminExceptionQueueItem["status"]) {
  switch (status) {
    case "needs_review":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "declined":
      return "border-red-200 bg-red-50 text-red-700";
    case "unfulfilled":
      return "border-orange-200 bg-orange-50 text-orange-700";
  }
}

export default async function AdminRequestExceptionsPage() {
  await requirePortalAccessOrRedirect({
    portal: "admin",
    currentPath: "/admin/requests/exceptions",
  });

  const queue = await getAdminExceptionQueue({ limit: 200 });
  const counts = {
    needsReview: queue.items.filter((item) => item.status === "needs_review").length,
    declined: queue.items.filter((item) => item.status === "declined").length,
    unfulfilled: queue.items.filter((item) => item.status === "unfulfilled").length,
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Exception Queue</h1>
        <p className="text-sm text-slate-600">
          Requests that need operator review or have reached a terminal exception outcome.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <AdminSectionCard title="Needs review" description="Requests pulled out of normal dispatch flow.">
          <Badge variant="outline" className={statusClassName("needs_review")}>
            {counts.needsReview} needs review
          </Badge>
        </AdminSectionCard>
        <AdminSectionCard title="Declined" description="Requests that cannot proceed after intake review.">
          <Badge variant="outline" className={statusClassName("declined")}>
            {counts.declined} declined
          </Badge>
        </AdminSectionCard>
        <AdminSectionCard title="Unfulfilled" description="Requests accepted operationally but not staffed.">
          <Badge variant="outline" className={statusClassName("unfulfilled")}>
            {counts.unfulfilled} unfulfilled
          </Badge>
        </AdminSectionCard>
      </div>

      <AdminSectionCard
        title="Queue snapshot"
        description={`Generated at ${new Date(queue.generatedAt).toLocaleString()} • ${queue.items.length} exception item(s)`}
        contentClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead className="bg-slate-100/80 text-slate-600">
              <tr>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Request</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Status</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Reason</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Wait</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Last actor</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Intake context</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Location hint</th>
              </tr>
            </thead>
            <tbody>
              {queue.items.map((item) => (
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
                    <Badge variant="outline" className={`capitalize ${statusClassName(item.status)}`}>
                      {item.status.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="max-w-md border-b border-slate-100 px-4 py-3 text-slate-700">
                    {item.reason ?? "-"}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-slate-700">{item.waitMinutes} min</td>
                  <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs text-slate-700">
                    {item.actorUserId ? `actor:${item.actorUserId.slice(0, 8)}` : "system"}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="capitalize">
                        {item.requestType.replace("_", "-")}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {item.referralSource}
                      </Badge>
                      {item.partnerLabel ? <Badge variant="outline">{item.partnerLabel}</Badge> : null}
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
              {queue.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    No exception requests found.
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
