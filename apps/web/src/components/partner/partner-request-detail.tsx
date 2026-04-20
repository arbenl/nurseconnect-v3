"use client";

type PartnerRequestDetailProps = {
  detail: {
    id: string;
    status: string;
    address: string;
    requestType: string;
    scheduledFor: string | null;
    careType: string | null;
    createdAt: string;
    patient: {
      firstName: string | null;
      lastName: string | null;
      phone: string | null;
      city: string | null;
    };
  };
};

export function PartnerRequestDetail({ detail }: PartnerRequestDetailProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Referral Detail</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">
            {[detail.patient.firstName, detail.patient.lastName].filter(Boolean).join(" ") || "Unnamed patient"}
          </h1>
          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-sky-700">
            {detail.status.replace(/_/g, " ")}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-600">{detail.address}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Patient contact</h2>
          <dl className="mt-4 space-y-3 text-sm text-slate-600">
            <div>
              <dt className="font-medium text-slate-500">Phone</dt>
              <dd>{detail.patient.phone ?? "-"}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">City</dt>
              <dd>{detail.patient.city ?? "-"}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Referral context</h2>
          <dl className="mt-4 space-y-3 text-sm text-slate-600">
            <div>
              <dt className="font-medium text-slate-500">Request type</dt>
              <dd className="capitalize">{detail.requestType.replace("_", " ")}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Care type</dt>
              <dd>{detail.careType ?? "-"}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Scheduled for</dt>
              <dd>{detail.scheduledFor ? new Date(detail.scheduledFor).toLocaleString() : "-"}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Created</dt>
              <dd>{new Date(detail.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}
