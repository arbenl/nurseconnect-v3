import { getAdminOpsDashboard } from "@nurseconnect/domain-admin-ops";
import Link from "next/link";

import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { Badge } from "@/components/ui/badge";
import { requirePortalAccessOrRedirect } from "@/server/auth";

function metricTone(
  value: number,
  thresholds: {
    warn: number;
    danger: number;
  },
) {
  if (value >= thresholds.danger) {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (value >= thresholds.warn) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function binaryTone(isReady: boolean) {
  return isReady
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-red-200 bg-red-50 text-red-700";
}

function signalLabel(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function paymentSignalLabel(kind: string) {
  switch (kind) {
    case "authorization_without_payout":
      return "Auth without payout";
    case "authorization_failed":
      return "Authorization failed";
    case "payout_failed":
      return "Payout failed";
    default:
      return "Payment follow-up";
  }
}

export default async function AdminDashboardPage() {
  const { user } = await requirePortalAccessOrRedirect({
    portal: "admin",
    currentPath: "/admin",
  });
  const dashboard = await getAdminOpsDashboard();
  const opsStatus = dashboard.opsStatus;
  const staleDispatchCount =
    opsStatus.requests.staleAssigned + opsStatus.requests.staleEnroute;
  const paymentAttentionCount =
    opsStatus.payments.authorizationsWithoutPayout +
    opsStatus.payments.recentFailedAuthorizations +
    opsStatus.payments.recentFailedPayouts;

  const topActions = [
    {
      href: "/admin/requests",
      label: "Active Requests",
      detail: `${dashboard.requestCounts.total} active • ${opsStatus.requests.unassigned} unassigned • ${dashboard.requestCounts.critical} critical`,
    },
    {
      href: "/admin/requests/exceptions",
      label: "Exception Queue",
      detail: `${opsStatus.requests.exceptionQueue} exception requests • ${staleDispatchCount} stale dispatch signals`,
    },
    {
      href: "/admin/nurses",
      label: "Credential Queue",
      detail: `${dashboard.credentialCounts.needsAttention} needs review • ${opsStatus.nurseSupply.verifiedAndAvailable} verified available`,
    },
    {
      href: "/admin/activity",
      label: "Reassignment Activity",
      detail: "Inspect recent request moves, operator actions, and audit-linked transitions.",
    },
    {
      href: "/admin/users",
      label: "User Management",
      detail: "Review role and access changes without leaving the operator lane.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Operations Console</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Live operator overview for trust, dispatch, and intervention. Generated at{" "}
          {new Date(dashboard.generatedAt).toLocaleString()}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminSectionCard
          title="Active requests"
          description="Current load across the dispatch lane."
          contentClassName="space-y-3"
        >
          <div className="text-3xl font-semibold text-slate-950">{dashboard.requestCounts.total}</div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={metricTone(dashboard.requestCounts.critical, { warn: 1, danger: 2 })}>
              {dashboard.requestCounts.critical} critical
            </Badge>
            <Badge variant="outline" className={metricTone(dashboard.requestCounts.high, { warn: 2, danger: 5 })}>
              {dashboard.requestCounts.high} high
            </Badge>
            <Badge variant="outline" className={metricTone(dashboard.requestCounts.unassigned, { warn: 1, danger: 3 })}>
              {dashboard.requestCounts.unassigned} unassigned
            </Badge>
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          title="Credential queue"
          description="Applicants and existing nurses needing action."
          contentClassName="space-y-3"
        >
          <div className="text-3xl font-semibold text-slate-950">{dashboard.credentialCounts.needsAttention}</div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
              {dashboard.credentialCounts.submitted} submitted
            </Badge>
            <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
              {dashboard.credentialCounts.under_review} under review
            </Badge>
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
              {dashboard.credentialCounts.renewal_pending} renewals
            </Badge>
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          title="Verified supply"
          description="Trusted nurses currently on the network."
          contentClassName="space-y-3"
        >
          <div className="text-3xl font-semibold text-slate-950">{dashboard.credentialCounts.verified}</div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              {dashboard.credentialCounts.available} available now
            </Badge>
            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
              {dashboard.credentialCounts.suspended + dashboard.credentialCounts.expired} blocked
            </Badge>
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          title="Current session"
          description="Authenticated admin context."
          contentClassName="space-y-3 text-sm text-slate-700"
        >
          <div className="font-medium text-slate-950">{user.email}</div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="capitalize">
              {user.role}
            </Badge>
            <Badge variant="outline" className="font-mono text-[11px]">
              {user.id.slice(0, 8)}
            </Badge>
          </div>
        </AdminSectionCard>
      </div>

      <AdminSectionCard
        title="Launch operator signals"
        description="Machine-readable launch health fields surfaced for first-hour decision making."
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium text-slate-950">Launch prerequisites</div>
              <Badge
                variant="outline"
                className={binaryTone(
                  opsStatus.serviceAreas.active > 0 &&
                    opsStatus.nurseSupply.verifiedAndAvailable > 0,
                )}
              >
                {opsStatus.serviceAreas.active > 0 &&
                opsStatus.nurseSupply.verifiedAndAvailable > 0
                  ? "ready"
                  : "blocked"}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className={binaryTone(opsStatus.serviceAreas.active > 0)}
              >
                {signalLabel(opsStatus.serviceAreas.active, "active area")}
              </Badge>
              <Badge
                variant="outline"
                className={binaryTone(opsStatus.nurseSupply.verifiedAndAvailable > 0)}
              >
                {opsStatus.nurseSupply.verifiedAndAvailable} verified available
              </Badge>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Controlled launch intake should stay paused if either service area
              coverage or verified available nurse supply is zero.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium text-slate-950">Dispatch attention</div>
              <Badge
                variant="outline"
                className={metricTone(
                  opsStatus.requests.unassigned + staleDispatchCount,
                  { warn: 1, danger: 3 },
                )}
              >
                {opsStatus.requests.unassigned + staleDispatchCount} signals
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className={metricTone(opsStatus.requests.unassigned, {
                  warn: 1,
                  danger: 3,
                })}
              >
                {opsStatus.requests.unassigned} unassigned
              </Badge>
              <Badge
                variant="outline"
                className={metricTone(opsStatus.requests.staleAssigned, {
                  warn: 1,
                  danger: 2,
                })}
              >
                {opsStatus.requests.staleAssigned} stale assigned
              </Badge>
              <Badge
                variant="outline"
                className={metricTone(opsStatus.requests.staleEnroute, {
                  warn: 1,
                  danger: 1,
                })}
              >
                {opsStatus.requests.staleEnroute} stale enroute
              </Badge>
              <Badge
                variant="outline"
                className={metricTone(opsStatus.requests.exceptionQueue, {
                  warn: 1,
                  danger: 3,
                })}
              >
                {signalLabel(opsStatus.requests.exceptionQueue, "exception")}
              </Badge>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Stale assigned and enroute counts use the same 20-minute policy as
              triage severity.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium text-slate-950">Payment follow-up</div>
              <Badge
                variant="outline"
                className={metricTone(paymentAttentionCount, {
                  warn: 1,
                  danger: 2,
                })}
              >
                {paymentAttentionCount} signals
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className={metricTone(
                  opsStatus.payments.authorizationsWithoutPayout,
                  { warn: 1, danger: 3 },
                )}
              >
                {opsStatus.payments.authorizationsWithoutPayout} auth no payout
              </Badge>
              <Badge
                variant="outline"
                className={metricTone(
                  opsStatus.payments.recentFailedAuthorizations,
                  { warn: 1, danger: 1 },
                )}
              >
                {opsStatus.payments.recentFailedAuthorizations} auth failed
              </Badge>
              <Badge
                variant="outline"
                className={metricTone(opsStatus.payments.recentFailedPayouts, {
                  warn: 1,
                  danger: 1,
                })}
              >
                {opsStatus.payments.recentFailedPayouts} payout failed
              </Badge>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              These are trace gaps and recent failed audit events for operator
              follow-up, not automated payment execution.
            </p>
            <div className="mt-4 space-y-2">
              {dashboard.paymentFollowUpItems.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                  No payment follow-up items.
                </div>
              ) : (
                dashboard.paymentFollowUpItems.map((item) => (
                  <Link
                    key={`${item.kind}:${item.requestId}:${item.createdAt}`}
                    href={`/admin/requests/${item.requestId}`}
                    className="block rounded-md border border-slate-200 bg-white px-3 py-2 text-sm transition hover:border-sky-300 hover:bg-sky-50"
                  >
                    <div className="font-medium text-slate-950">
                      {paymentSignalLabel(item.kind)} · {item.requestId.slice(0, 8)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {new Date(item.createdAt).toLocaleString()}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </AdminSectionCard>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <AdminSectionCard
          title="Immediate attention"
          description="Top issues to clear before taking on lower-priority ops work."
        >
          <div className="grid gap-3">
            {dashboard.recentHotRequests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No active requests need intervention right now.
              </div>
            ) : (
              dashboard.recentHotRequests.map((item) => (
                <Link
                  key={item.requestId}
                  href={`/admin/requests/${item.requestId}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-sky-300 hover:bg-white"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium text-slate-950">{item.requestId.slice(0, 8)}</div>
                    <Badge variant="outline" className="capitalize">
                      {item.status}
                    </Badge>
                    <Badge variant="outline" className={metricTone(item.severityScore, { warn: 65, danger: 85 })}>
                      {item.severityBand}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {item.requestType.replace("_", "-")}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {item.referralSource}
                    </Badge>
                    {item.partnerLabel ? (
                      <Badge variant="outline">{item.partnerLabel}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    Wait {item.waitMinutes} min • {item.assignedNurse} • {item.locationHint}
                    {item.careType ? ` • ${item.careType}` : ""}
                  </p>
                </Link>
              ))
            )}
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          title="Primary lanes"
          description="Jump straight into the operator surface you need."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {topActions.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-sky-300 hover:bg-white"
              >
                <div className="font-medium text-slate-950">{item.label}</div>
                <p className="mt-2 text-sm text-slate-600">{item.detail}</p>
              </Link>
            ))}
            <Link
              href="/admin/backfill"
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-sky-300 hover:bg-white sm:col-span-2"
            >
              <div className="font-medium text-slate-950">Backfill Status</div>
              <p className="mt-2 text-sm text-slate-600">
                Check migration/backfill progress before operator-facing changes land.
              </p>
            </Link>
          </div>
        </AdminSectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminSectionCard
          title="Credential review queue"
          description="Recent applicants and renewals needing trust decisions."
        >
          <div className="grid gap-3">
            {dashboard.pendingCredentialItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No pending credential work.
              </div>
            ) : (
              dashboard.pendingCredentialItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/admin/nurses/${item.id}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-sky-300 hover:bg-white"
                >
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-slate-950">{item.userName ?? item.userEmail ?? "Unknown applicant"}</div>
                    <Badge variant="outline" className="uppercase">
                      {item.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {item.userEmail} • License {item.licenseNumber ?? "N/A"} • Updated{" "}
                    {new Date(item.updatedAt).toLocaleString()}
                  </p>
                </Link>
              ))
            )}
          </div>
        </AdminSectionCard>

        <AdminSectionCard
          title="Recent reassignment activity"
          description="Audit-linked operator actions and request-event transitions."
        >
          <div className="grid gap-3">
            {dashboard.recentActivity.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No recent reassignment activity.
              </div>
            ) : (
              dashboard.recentActivity.map((item) => (
                <div
                  key={`${item.source}:${item.id}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{item.source}</Badge>
                    <span className="font-medium text-slate-950">{item.requestId.slice(0, 8)}</span>
                    <span className="text-sm text-slate-500">{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {item.metadata.previousNurseUserId?.slice(0, 8) ?? "-"} →{" "}
                    {item.metadata.newNurseUserId?.slice(0, 8) ?? "-"}
                  </p>
                </div>
              ))
            )}
          </div>
        </AdminSectionCard>
      </div>
    </div>
  );
}
