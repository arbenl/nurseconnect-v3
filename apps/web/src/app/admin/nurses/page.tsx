import {
  getNurseCredentialCounts,
  listNurseCredentials,
  type NurseCredentialStatus,
} from "@nurseconnect/domain-nurse";
import Link from "next/link";

import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { Badge } from "@/components/ui/badge";
import { requirePortalAccessOrRedirect } from "@/server/auth";

type PageProps = {
  searchParams?: {
    status?: string;
  };
};

const REVIEW_STATUSES: NurseCredentialStatus[] = ["submitted", "under_review", "renewal_pending"];

function badgeClassName(status: NurseCredentialStatus) {
  switch (status) {
    case "verified":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "submitted":
    case "under_review":
    case "renewal_pending":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "rejected":
      return "border-red-200 bg-red-50 text-red-700";
    case "suspended":
    case "expired":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function buildHref(status?: string) {
  if (!status || status === "review") {
    return "/admin/nurses";
  }
  return `/admin/nurses?status=${status}`;
}

export default async function AdminNursesQueuePage({ searchParams }: PageProps) {
  await requirePortalAccessOrRedirect({ portal: "admin", currentPath: "/admin/nurses" });

  const statusFilter = searchParams?.status;
  const statuses =
    statusFilter && statusFilter !== "review"
      ? [statusFilter]
      : REVIEW_STATUSES;

  const [items, counts] = await Promise.all([
    listNurseCredentials({ statuses }),
    getNurseCredentialCounts(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Credential Review Queue</h1>
        <p className="mt-2 text-sm text-slate-600">
          Review applicants, renewals, and blocked nurses from one trust surface.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <AdminSectionCard title="Review queue" description="Applicants and renewals needing a trust decision.">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
              {counts.submitted} submitted
            </Badge>
            <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
              {counts.under_review} under review
            </Badge>
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
              {counts.renewal_pending} renewals
            </Badge>
          </div>
        </AdminSectionCard>
        <AdminSectionCard title="Trusted supply" description="Current verified and blocked supply state.">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              {counts.verified} verified
            </Badge>
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
              {counts.suspended + counts.expired} blocked
            </Badge>
          </div>
        </AdminSectionCard>
        <AdminSectionCard title="Recent outcomes" description="Rejections and drafts still in the system.">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
              {counts.rejected} rejected
            </Badge>
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
              {counts.draft} drafts
            </Badge>
          </div>
        </AdminSectionCard>
      </div>

      <AdminSectionCard title="Filters" description="Swap between the live review queue and other trust states.">
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Review Queue", value: "review" },
            { label: "Verified", value: "verified" },
            { label: "Suspended", value: "suspended" },
            { label: "Expired", value: "expired" },
            { label: "Rejected", value: "rejected" },
          ].map((item) => (
            <Link
              key={item.value}
              href={buildHref(item.value)}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition hover:border-sky-300 hover:bg-sky-50"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </AdminSectionCard>

      <AdminSectionCard
        title="Applications and trust decisions"
        description={`${items.length} visible item(s) in the current credential lane.`}
        contentClassName="p-0"
      >
        {items.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">No nurses match the current filter.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/admin/nurses/${item.id}`}
                className="grid gap-3 px-6 py-5 transition hover:bg-sky-50/50 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-950">{item.userName || item.userEmail || "Unknown user"}</h3>
                    <Badge variant="outline" className={badgeClassName(item.status)}>
                      {item.status}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {item.userRole}
                    </Badge>
                  </div>
                  <div className="text-sm text-slate-600">{item.userEmail}</div>
                </div>

                <div className="space-y-1 text-sm text-slate-600">
                  <div>License: {item.licenseNumber || "N/A"}</div>
                  <div>Jurisdiction: {item.licenseJurisdiction || "N/A"}</div>
                  <div>Specialization: {item.specialization || "N/A"}</div>
                </div>

                <div className="space-y-1 text-sm text-slate-500 md:text-right">
                  <div>Updated {new Date(item.updatedAt).toLocaleString()}</div>
                  <div>
                    {item.licenseValidUntil
                      ? `Valid until ${new Date(item.licenseValidUntil).toLocaleDateString()}`
                      : "No expiry recorded"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </AdminSectionCard>
    </div>
  );
}
