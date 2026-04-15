import { getNurseCredentialById } from "@nurseconnect/domain-nurse";
import { notFound } from "next/navigation";

import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { Badge } from "@/components/ui/badge";
import { requirePortalAccessOrRedirect } from "@/server/auth";

import { NurseActions } from "./nurse-actions";

type PageProps = {
  params: {
    id: string;
  };
};

function formatDateTime(value: Date | null) {
  return value ? value.toLocaleString() : "-";
}

function badgeClassName(status: string) {
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

export default async function AdminNurseDetailPage({ params }: PageProps) {
  await requirePortalAccessOrRedirect({ portal: "admin", currentPath: `/admin/nurses/${params.id}` });
  const nurse = await getNurseCredentialById(params.id);

  if (!nurse) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Review Application</h1>
        <p className="mt-2 text-sm text-slate-600">
          Trust decision surface for {nurse.userName || nurse.userEmail || "unknown nurse"}.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <AdminSectionCard
          title="Credential summary"
          description="Submitted identity and nurse application details."
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={badgeClassName(nurse.status)}>
              {nurse.status}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {nurse.userRole}
            </Badge>
            <Badge
              variant="outline"
              className={
                nurse.isAvailable
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }
            >
              {nurse.isAvailable ? "available" : "offline"}
            </Badge>
          </div>

          <div className="grid gap-4 text-sm text-slate-700 sm:grid-cols-2">
            <div>
              <div className="font-medium text-slate-500">User</div>
              <div className="mt-1 text-slate-950">{nurse.userName || "N/A"}</div>
              <div>{nurse.userEmail || "N/A"}</div>
            </div>
            <div>
              <div className="font-medium text-slate-500">IDs</div>
              <div className="mt-1 font-mono text-xs text-slate-950">{nurse.userId}</div>
              <div className="font-mono text-xs">{nurse.id}</div>
            </div>
            <div>
              <div className="font-medium text-slate-500">License</div>
              <div className="mt-1 font-mono text-slate-950">{nurse.licenseNumber || "N/A"}</div>
              <div>{nurse.licenseJurisdiction || "No jurisdiction set"}</div>
            </div>
            <div>
              <div className="font-medium text-slate-500">Specialization</div>
              <div className="mt-1 text-slate-950">{nurse.specialization || "N/A"}</div>
            </div>
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          title="Verification history"
          description="Current approval and suspension metadata for this nurse record."
        >
          <div className="grid gap-4 text-sm text-slate-700">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <span className="font-medium text-slate-500">Applied</span>
              <span>{formatDateTime(nurse.createdAt)}</span>
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <span className="font-medium text-slate-500">Last updated</span>
              <span>{formatDateTime(nurse.updatedAt)}</span>
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <span className="font-medium text-slate-500">Verified at</span>
              <span>{formatDateTime(nurse.verifiedAt)}</span>
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <span className="font-medium text-slate-500">Verified by</span>
              <span className="font-mono text-xs">{nurse.verifiedBy ?? "-"}</span>
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <span className="font-medium text-slate-500">License valid until</span>
              <span>{formatDateTime(nurse.licenseValidUntil)}</span>
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <span className="font-medium text-slate-500">Suspended at</span>
              <span>{formatDateTime(nurse.suspendedAt)}</span>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-slate-500">Suspension reason</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {nurse.suspensionReason || "No suspension reason recorded."}
              </div>
            </div>
          </div>
        </AdminSectionCard>
      </div>

      <NurseActions
        nurseId={nurse.id}
        initialJurisdiction={nurse.licenseJurisdiction ?? ""}
        initialValidUntil={nurse.licenseValidUntil ? nurse.licenseValidUntil.toISOString().slice(0, 10) : ""}
        initialStatus={nurse.status}
      />
    </div>
  );
}
