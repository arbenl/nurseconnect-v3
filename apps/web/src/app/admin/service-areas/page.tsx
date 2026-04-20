import { MapPin } from "lucide-react";

import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { Badge } from "@/components/ui/badge";
import { requirePortalAccessOrRedirect } from "@/server/auth";
import { listAdminServiceAreas } from "@/server/service-areas/admin-service-areas";

import { CreateAreaForm } from "./create-area-form";
import { ServiceAreaStatusActions } from "./service-area-status-actions";

function formatRadius(radiusMeters: number) {
  return `${(radiusMeters / 1000).toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })} km`;
}

function statusClassName(status: "active" | "paused") {
  if (status === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

export default async function AdminServiceAreasPage() {
  await requirePortalAccessOrRedirect({
    portal: "admin",
    currentPath: "/admin/service-areas",
  });

  const { items } = await listAdminServiceAreas();
  const activeCount = items.filter((item) => item.status === "active").length;
  const pausedCount = items.length - activeCount;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Service Areas</h1>
        <p className="text-sm text-slate-600">
          Circle-based operating controls for patient intake, partner intake, nurse location tags, and dispatch scope.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <AdminSectionCard title="Coverage" description="Active areas accepting new request intake.">
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
            {activeCount} active
          </Badge>
        </AdminSectionCard>
        <AdminSectionCard title="Paused" description="Areas blocked for new intake while retaining history.">
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
            {pausedCount} paused
          </Badge>
        </AdminSectionCard>
        <AdminSectionCard title="Total" description="Configured city or metro operating zones.">
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
            {items.length} configured
          </Badge>
        </AdminSectionCard>
      </div>

      <AdminSectionCard title="Create Area" description="Add a center point and radius for a city-scale operating zone.">
        <CreateAreaForm />
      </AdminSectionCard>

      <AdminSectionCard
        title="Configured Areas"
        description={`${items.length} service area(s) ordered by label.`}
        contentClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead className="bg-slate-100/80 text-slate-600">
              <tr>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Area</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Center</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Radius</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Status</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Updated</th>
                <th className="border-b border-slate-200 px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="bg-white transition odd:bg-slate-50/60 hover:bg-sky-50/40">
                  <td className="border-b border-slate-100 px-4 py-3">
                    <div className="flex items-center gap-2 font-semibold text-slate-950">
                      <MapPin className="h-4 w-4 text-sky-600" />
                      {item.label}
                    </div>
                    <div className="mt-1 font-mono text-xs text-slate-500">{item.id}</div>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs text-slate-700">
                    {item.centerLat}, {item.centerLng}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-slate-700">
                    {formatRadius(item.radiusMeters)}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3">
                    <Badge variant="outline" className={`capitalize ${statusClassName(item.status)}`}>
                      {item.status}
                    </Badge>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-slate-600">
                    {new Date(item.updatedAt).toLocaleString()}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3">
                    <ServiceAreaStatusActions id={item.id} status={item.status} />
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                    No service areas have been configured.
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
