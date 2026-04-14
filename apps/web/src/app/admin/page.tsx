import Link from "next/link";

import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { Badge } from "@/components/ui/badge";
import { requirePortalAccessOrRedirect } from "@/server/auth";

export default async function AdminDashboardPage() {
  const { user } = await requirePortalAccessOrRedirect({
    portal: "admin",
    currentPath: "/admin",
  });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Operations Console</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Run the day-to-day admin lane from one readable surface: credential review, active request
          monitoring, role management, and migration oversight.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.4fr)]">
        <AdminSectionCard
          title="Current session"
          description="The authenticated admin context currently driving this workspace."
        >
          <dl className="grid gap-4 text-sm text-slate-700">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <dt className="font-medium text-slate-500">ID</dt>
              <dd className="font-mono text-xs text-slate-900">{user.id}</dd>
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <dt className="font-medium text-slate-500">Email</dt>
              <dd className="text-right text-slate-900">{user.email}</dd>
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <dt className="font-medium text-slate-500">Role</dt>
              <dd>
                <Badge variant="secondary" className="capitalize">
                  {user.role}
                </Badge>
              </dd>
            </div>
            {user.firebaseUid ? (
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                <dt className="font-medium text-slate-500">Firebase UID</dt>
                <dd className="font-mono text-xs text-slate-900">{user.firebaseUid}</dd>
              </div>
            ) : null}
            <div className="flex items-start justify-between gap-4">
              <dt className="font-medium text-slate-500">Provider</dt>
              <dd className="font-mono text-slate-900">Better Auth</dd>
            </div>
          </dl>
        </AdminSectionCard>

        <AdminSectionCard
          title="Management lanes"
          description="Primary operator paths for trust, dispatch, and account control."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                href: "/admin/requests",
                label: "Active Requests Queue",
                detail: "Review the live triage feed and drill into request timelines.",
              },
              {
                href: "/admin/nurses",
                label: "Nurse Credential Review Queue",
                detail: "Verify pending nurse applications and control trusted supply.",
              },
              {
                href: "/admin/activity",
                label: "Reassignment Activity Feed",
                detail: "Inspect request changes and audit-linked operational history.",
              },
              {
                href: "/admin/users",
                label: "Manage Users",
                detail: "Review roles and access for patient, nurse, and admin accounts.",
              },
              {
                href: "/admin/backfill",
                label: "Backfill Status",
                detail: "Check migration and backfill progress before operator-facing changes.",
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-sky-300 hover:bg-white"
              >
                <div className="font-medium text-slate-950">{item.label}</div>
                <p className="mt-2 text-sm text-slate-600">{item.detail}</p>
              </Link>
            ))}
          </div>
        </AdminSectionCard>
      </div>
    </div>
  );
}
