"use client";

import { useEffect, useState } from "react";

type PartnerRequestFormProps = {
  onCreated: () => Promise<void> | void;
};

const initialState = {
  lat: "42.6629",
  lng: "21.1655",
  requestType: "same_day" as "same_day" | "scheduled",
};

export function PartnerRequestForm({ onCreated }: PartnerRequestFormProps) {
  const [requestType, setRequestType] = useState(initialState.requestType);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setIsSubmitting(true);
    setError(null);

    try {
      const scheduledForValue = String(formData.get("scheduledFor") ?? "");
      const scheduledFor =
        requestType === "scheduled" && scheduledForValue
          ? new Date(scheduledForValue).toISOString()
          : undefined;

      const res = await fetch("/api/partner/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient: {
            email: String(formData.get("patientEmail") ?? ""),
            firstName: String(formData.get("patientFirstName") ?? ""),
            lastName: String(formData.get("patientLastName") ?? ""),
            phone: String(formData.get("patientPhone") ?? "") || undefined,
            city: String(formData.get("patientCity") ?? "") || undefined,
          },
          address: String(formData.get("address") ?? ""),
          lat: Number(formData.get("lat")),
          lng: Number(formData.get("lng")),
          requestType,
          scheduledFor,
          careType: String(formData.get("careType") ?? "") || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? body?.message ?? "Failed to submit referral");
      }

      form.reset();
      setRequestType(initialState.requestType);
      await onCreated();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to submit referral");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          New Referral
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">Submit a patient referral</h2>
      </div>
      <form className="grid gap-4 md:grid-cols-2" method="post" onSubmit={handleSubmit}>
        <input
          aria-label="Patient email"
          name="patientEmail"
          className="rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Patient email"
          required
        />
        <input
          aria-label="Patient first name"
          name="patientFirstName"
          className="rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Patient first name"
          required
        />
        <input
          aria-label="Patient last name"
          name="patientLastName"
          className="rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Patient last name"
          required
        />
        <input
          aria-label="Patient phone"
          name="patientPhone"
          className="rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Patient phone"
        />
        <input
          aria-label="Patient city"
          name="patientCity"
          className="rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Patient city"
        />
        <input
          aria-label="Visit address"
          name="address"
          className="rounded-xl border border-slate-200 px-4 py-3 md:col-span-2"
          placeholder="Visit address"
          required
        />
        <input
          aria-label="Latitude"
          name="lat"
          className="rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Latitude"
          defaultValue={initialState.lat}
          required
        />
        <input
          aria-label="Longitude"
          name="lng"
          className="rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Longitude"
          defaultValue={initialState.lng}
          required
        />
        <select
          aria-label="Visit type"
          name="requestType"
          className="rounded-xl border border-slate-200 px-4 py-3"
          value={requestType}
          onChange={(event) => setRequestType(event.target.value as "same_day" | "scheduled")}
        >
          <option value="same_day">Same day</option>
          <option value="scheduled">Scheduled</option>
        </select>
        <input
          aria-label="Care type"
          name="careType"
          className="rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Care type"
        />
        {requestType === "scheduled" && (
          <input
            aria-label="Scheduled for"
            name="scheduledFor"
            className="rounded-xl border border-slate-200 px-4 py-3 md:col-span-2"
            type="datetime-local"
            required
          />
        )}
        {error ? <p className="text-sm text-red-600 md:col-span-2">{error}</p> : null}
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={isSubmitting || !isHydrated}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
          >
            {isSubmitting ? "Submitting..." : "Submit Referral"}
          </button>
        </div>
      </form>
    </section>
  );
}
