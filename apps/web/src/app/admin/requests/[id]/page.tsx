import { asc, db, desc, eq, schema, and, or, isNull, gt } from "@nurseconnect/database";
import { notFound } from "next/navigation";

import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { Badge } from "@/components/ui/badge";
import { requirePortalAccessOrRedirect } from "@/server/auth";
import {
  RequestEventNotFoundError,
  getRequestEventsForUser,
} from "@/server/requests/request-events";
import { toLocationHint } from "@/server/requests/triage-severity";

import ReassignPanel from "./reassign-panel";

const { nurses, serviceRequests, users } = schema;

type PageProps = {
  params: {
    id: string;
  };
};

function formatDate(value: Date | null) {
  if (!value) {
    return "-";
  }
  return value.toLocaleString();
}

function actorLabel(actorUserId: string | null) {
  if (!actorUserId) {
    return "system";
  }
  return `actor:${actorUserId.slice(0, 8)}`;
}

export default async function AdminRequestDetailPage({ params }: PageProps) {
  const { user } = await requirePortalAccessOrRedirect({
    portal: "admin",
    currentPath: `/admin/requests/${params.id}`,
  });

  const request = await db.query.serviceRequests.findFirst({
    where: eq(serviceRequests.id, params.id),
  });

  if (!request) {
    notFound();
  }

  const nurseCandidates = await db
    .select({
      userId: users.id,
      email: users.email,
      isAvailable: nurses.isAvailable,
    })
    .from(users)
    .innerJoin(nurses, eq(nurses.userId, users.id))
    .where(
      and(
        eq(users.role, "nurse"),
        eq(nurses.status, "verified"),
        or(isNull(nurses.licenseValidUntil), gt(nurses.licenseValidUntil, new Date()))
      )
    )
    .orderBy(desc(nurses.isAvailable), asc(users.email));

  let events;
  try {
    events = await getRequestEventsForUser({
      requestId: request.id,
      actorUserId: user.id,
      actorRole: user.role,
    });
  } catch (error) {
    if (error instanceof RequestEventNotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Request Detail</h1>
        <p className="text-sm text-slate-600">
          Read-only admin timeline. PHI-safe summary fields only.
        </p>
      </div>

      <AdminSectionCard
        title="Request summary"
        description="Operational context for the request before reassignment or timeline review."
      >
        <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
          <div>
            <strong>Request:</strong> <span className="font-mono text-xs">{request.id}</span>
          </div>
          <div>
            <strong>Status:</strong>{" "}
            <Badge variant="outline" className="ml-2 capitalize">
              {request.status}
            </Badge>
          </div>
          <div>
            <strong>Assigned:</strong> {request.assignedNurseUserId ? "assigned" : "unassigned"}
          </div>
          <div>
            <strong>Location Hint:</strong>{" "}
            <span className="font-mono text-xs">
              {toLocationHint(request.lat, request.lng, 2)}
            </span>
          </div>
          <div>
            <strong>Created:</strong> {formatDate(request.createdAt)}
          </div>
          <div>
            <strong>Updated:</strong> {formatDate(request.updatedAt)}
          </div>
        </div>
      </AdminSectionCard>

      <ReassignPanel
        requestId={request.id}
        currentAssignedNurseUserId={request.assignedNurseUserId}
        nurseCandidates={nurseCandidates}
      />

      <AdminSectionCard title="Timeline" description="Request lifecycle events and actor transitions.">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead className="bg-slate-100/80 text-slate-600">
            <tr>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Time</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Event</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Transition</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Actor</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="bg-white transition odd:bg-slate-50/60 hover:bg-sky-50/40">
                <td className="border-b border-slate-100 px-4 py-3 text-slate-700">
                  {new Date(event.createdAt).toLocaleString()}
                </td>
                <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs text-slate-900">
                  {event.type}
                </td>
                <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs text-slate-700">
                  {(event.fromStatus ?? "-") + " -> " + (event.toStatus ?? "-")}
                </td>
                <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs text-slate-700">
                  {actorLabel(event.actorUserId)}
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-slate-500">
                  No events found for this request.
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
