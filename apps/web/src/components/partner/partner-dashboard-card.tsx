"use client";

type PartnerDashboardCardProps = {
  totalRequests: number;
  recentRequests: number;
};

export function PartnerDashboardCard(props: PartnerDashboardCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Referral Inbox
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            {props.totalRequests} tracked referral{props.totalRequests === 1 ? "" : "s"}
          </h2>
        </div>
        <div className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
          {props.recentRequests} recent
        </div>
      </div>
      <p className="mt-4 max-w-2xl text-sm text-slate-600">
        Submit new referrals through the shared NurseConnect workflow and monitor the
        limited status projection here without exposing internal ops details.
      </p>
    </section>
  );
}
