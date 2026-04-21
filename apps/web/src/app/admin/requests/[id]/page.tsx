import { asc, db, desc, eq, schema, and, or, isNull, gt } from "@nurseconnect/database";
import { toLocationHint } from "@nurseconnect/domain-admin-ops";
import { VisitNotFoundError, getVisitTimelineForActor } from "@nurseconnect/domain-visit";
import { notFound } from "next/navigation";

import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { Badge } from "@/components/ui/badge";
import { requirePortalAccessOrRedirect } from "@/server/auth";
import { getAdminPaymentTrace } from "@/server/payments/admin-payment-trace";

import PaymentTracePanel from "./payment-trace-panel";
import ReassignPanel from "./reassign-panel";
import TriageExceptionPanel from "./triage-exception-panel";

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

function statusBadgeClassName(status: string) {
  switch (status) {
    case "needs_review":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "declined":
      return "border-red-200 bg-red-50 text-red-700";
    case "unfulfilled":
      return "border-orange-200 bg-orange-50 text-orange-700";
    default:
      return "";
  }
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
      status: nurses.status,
      isAvailable: nurses.isAvailable,
      licenseValidUntil: nurses.licenseValidUntil,
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

  const paymentTrace = await getAdminPaymentTrace(request.id);

  let events;
  try {
    events = await getVisitTimelineForActor(db, {
      requestId: request.id,
      actorUserId: user.id,
      actorRole: "admin",
    });
  } catch (error) {
    if (error instanceof VisitNotFoundError) {
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
        <div data-testid="request-summary" className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
          <div>
            <strong>Request:</strong> <span className="font-mono text-xs">{request.id}</span>
          </div>
          <div>
            <strong>Status:</strong>{" "}
            <Badge variant="outline" className={`ml-2 capitalize ${statusBadgeClassName(request.status)}`}>
              {request.status.replace("_", " ")}
            </Badge>
          </div>
          <div>
            <strong>Assigned:</strong> {request.assignedNurseUserId ? "assigned" : "unassigned"}
          </div>
          <div>
            <strong>Dispatch mode:</strong> <span className="capitalize">{request.requestType.replace("_", "-")}</span>
          </div>
          <div>
            <strong>Referral source:</strong> <span className="capitalize">{request.referralSource}</span>
          </div>
          <div>
            <strong>Care type:</strong> {request.careType ?? "-"}
          </div>
          <div>
            <strong>Scheduled for:</strong> {formatDate(request.scheduledFor)}
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

      <TriageExceptionPanel requestId={request.id} status={request.status} />

      <PaymentTracePanel
        requestId={request.id}
        requestStatus={request.status}
        assignedNurseUserId={request.assignedNurseUserId}
        trace={paymentTrace}
      />

      <ReassignPanel
        requestId={request.id}
        currentStatus={request.status}
        currentAssignedNurseUserId={request.assignedNurseUserId}
        nurseCandidates={nurseCandidates.map((candidate) => ({
          ...candidate,
          licenseValidUntil: candidate.licenseValidUntil?.toISOString() ?? null,
        }))}
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
