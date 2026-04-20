"use client";

import { useState } from "react";

type PartnerRequestFormProps = {
  onCreated: () => Promise<void> | void;
};

const initialState = {
  patientEmail: "",
  patientFirstName: "",
  patientLastName: "",
  patientPhone: "",
  patientCity: "",
  address: "",
  lat: "42.6629",
  lng: "21.1655",
  requestType: "same_day" as "same_day" | "scheduled",
  scheduledFor: "",
  careType: "",
};

export function PartnerRequestForm({ onCreated }: PartnerRequestFormProps) {
  const [form, setForm] = useState(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/partner/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient: {
            email: form.patientEmail,
            firstName: form.patientFirstName,
            lastName: form.patientLastName,
            phone: form.patientPhone || undefined,
            city: form.patientCity || undefined,
          },
          address: form.address,
          lat: Number(form.lat),
          lng: Number(form.lng),
          requestType: form.requestType,
          scheduledFor: form.requestType === "scheduled" ? form.scheduledFor : undefined,
          careType: form.careType || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? body?.message ?? "Failed to submit referral");
      }

      setForm(initialState);
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
      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <input
          className="rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Patient email"
          value={form.patientEmail}
          onChange={(event) => setForm((current) => ({ ...current, patientEmail: event.target.value }))}
          required
        />
        <input
          className="rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Patient first name"
          value={form.patientFirstName}
          onChange={(event) => setForm((current) => ({ ...current, patientFirstName: event.target.value }))}
          required
        />
        <input
          className="rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Patient last name"
          value={form.patientLastName}
          onChange={(event) => setForm((current) => ({ ...current, patientLastName: event.target.value }))}
          required
        />
        <input
          className="rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Patient phone"
          value={form.patientPhone}
          onChange={(event) => setForm((current) => ({ ...current, patientPhone: event.target.value }))}
        />
        <input
          className="rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Patient city"
          value={form.patientCity}
          onChange={(event) => setForm((current) => ({ ...current, patientCity: event.target.value }))}
        />
        <input
          className="rounded-xl border border-slate-200 px-4 py-3 md:col-span-2"
          placeholder="Visit address"
          value={form.address}
          onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
          required
        />
        <input
          className="rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Latitude"
          value={form.lat}
          onChange={(event) => setForm((current) => ({ ...current, lat: event.target.value }))}
          required
        />
        <input
          className="rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Longitude"
          value={form.lng}
          onChange={(event) => setForm((current) => ({ ...current, lng: event.target.value }))}
          required
        />
        <select
          className="rounded-xl border border-slate-200 px-4 py-3"
          value={form.requestType}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              requestType: event.target.value as "same_day" | "scheduled",
              scheduledFor:
                event.target.value === "scheduled" ? current.scheduledFor : "",
            }))
          }
        >
          <option value="same_day">Same day</option>
          <option value="scheduled">Scheduled</option>
        </select>
        <input
          className="rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Care type"
          value={form.careType}
          onChange={(event) => setForm((current) => ({ ...current, careType: event.target.value }))}
        />
        {form.requestType === "scheduled" && (
          <input
            className="rounded-xl border border-slate-200 px-4 py-3 md:col-span-2"
            type="datetime-local"
            value={form.scheduledFor}
            onChange={(event) => setForm((current) => ({ ...current, scheduledFor: event.target.value }))}
            required
          />
        )}
        {error ? <p className="text-sm text-red-600 md:col-span-2">{error}</p> : null}
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
          >
            {isSubmitting ? "Submitting..." : "Submit Referral"}
          </button>
        </div>
      </form>
    </section>
  );
}
