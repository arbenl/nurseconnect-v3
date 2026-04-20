"use client";

import { MapPin, PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type FeedbackState = {
  tone: "success" | "error";
  message: string;
} | null;

export function CreateAreaForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setFeedback(null);
    setIsSubmitting(true);
    const label = String(formData.get("label") ?? "").trim();
    const centerLat = Number(formData.get("centerLat"));
    const centerLng = Number(formData.get("centerLng"));
    const radiusKm = Number(formData.get("radiusKm"));

    try {
      const response = await fetch("/api/admin/service-areas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label,
          centerLat,
          centerLng,
          radiusMeters: Math.round(radiusKm * 1000),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = typeof body?.error === "string" ? body.error : `Request failed with status ${response.status}`;
        setFeedback({ tone: "error", message });
        return;
      }

      form.reset();
      setFeedback({ tone: "success", message: "Service area created." });
      startTransition(() => router.refresh());
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto] md:items-end">
        <div className="grid gap-2">
          <Label htmlFor="service-area-label">Label</Label>
          <input
            id="service-area-label"
            name="label"
            required
            maxLength={200}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            placeholder="Pristina Metro"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="service-area-lat">Latitude</Label>
          <input
            id="service-area-lat"
            name="centerLat"
            required
            type="number"
            min="-90"
            max="90"
            step="0.000001"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            placeholder="42.662900"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="service-area-lng">Longitude</Label>
          <input
            id="service-area-lng"
            name="centerLng"
            required
            type="number"
            min="-180"
            max="180"
            step="0.000001"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            placeholder="21.165500"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="service-area-radius">Radius km</Label>
          <input
            id="service-area-radius"
            name="radiusKm"
            required
            type="number"
            min="0.5"
            max="100"
            step="0.1"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            placeholder="15"
          />
        </div>
        <Button type="submit" disabled={isPending || isSubmitting} className="h-10">
          {isPending || isSubmitting ? <MapPin className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
          {isPending || isSubmitting ? "Creating" : "Create"}
        </Button>
      </div>

      <div
        aria-live="polite"
        className={[
          "min-h-10 rounded-md border px-4 py-3 text-sm",
          feedback?.tone === "error"
            ? "border-red-200 bg-red-50 text-red-700"
            : feedback?.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-dashed border-slate-200 bg-slate-50 text-slate-500",
        ].join(" ")}
      >
        {feedback?.message ?? "Create or update operating coverage areas for intake and dispatch."}
      </div>
    </form>
  );
}
