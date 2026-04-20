"use client";

import Link from "next/link";

type PartnerRequestListProps = {
  items: Array<{
    id: string;
    status: string;
    address: string;
    requestType: string;
    careType: string | null;
    createdAt: string;
    patient: {
      firstName: string | null;
      lastName: string | null;
    };
  }>;
};

export function PartnerRequestList({ items }: PartnerRequestListProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Your Referrals
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">Tracked requests</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {items.length === 0 ? (
          <div className="px-6 py-8 text-sm text-slate-500">
            No referrals yet.
          </div>
        ) : (
          items.map((item) => (
            <Link
              key={item.id}
              href={`/partner/requests/${item.id}`}
              className="block px-6 py-4 transition hover:bg-slate-50"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {[item.patient.firstName, item.patient.lastName].filter(Boolean).join(" ") || "Unnamed patient"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{item.address}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {item.requestType.replace(/_/g, " ")}{item.careType ? ` · ${item.careType}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <div className="inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-sky-700">
                    {item.status.replace(/_/g, " ")}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
