"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type NurseCandidate = {
  userId: string;
  email: string;
  status: string;
  isAvailable: boolean;
  licenseValidUntil: string | null;
};

type ReassignPanelProps = {
  requestId: string;
  currentAssignedNurseUserId: string | null;
  nurseCandidates: NurseCandidate[];
};

type FeedbackState = {
  tone: "success" | "error";
  message: string;
} | null;

export default function ReassignPanel({
  requestId,
  currentAssignedNurseUserId,
  nurseCandidates,
}: ReassignPanelProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const [selectedNurseUserId, setSelectedNurseUserId] = useState<string>(() => {
    if (currentAssignedNurseUserId) {
      return currentAssignedNurseUserId;
    }
    return nurseCandidates[0]?.userId ?? "";
  });

  const selectedNurseLabel = useMemo(() => {
    const found = nurseCandidates.find((candidate) => candidate.userId === selectedNurseUserId);
    return found ? found.email : "";
  }, [nurseCandidates, selectedNurseUserId]);

  const selectedNurse = useMemo(
    () => nurseCandidates.find((candidate) => candidate.userId === selectedNurseUserId) ?? null,
    [nurseCandidates, selectedNurseUserId],
  );

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  async function submitReassignment(nurseUserId: string | null) {
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/requests/${requestId}/reassign`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ nurseUserId }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message =
          typeof body?.error === "string" ? body.error : `Request failed with status ${response.status}`;
        setFeedback({ tone: "error", message });
        return;
      }

      if (nurseUserId) {
        setFeedback({
          tone: "success",
          message: `Request reassigned to ${selectedNurseLabel || nurseUserId.slice(0, 8)}.`,
        });
        setSelectedNurseUserId(nurseUserId);
      } else {
        setFeedback({ tone: "success", message: "Request unassigned." });
      }

      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setFeedback({ tone: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      data-testid="reassign-panel"
      data-hydrated={isHydrated ? "true" : "false"}
      className="mt-6"
    >
      <AdminSectionCard
        title="Triage Actions"
        description="Reassign requests without exposing PHI fields. Availability is updated automatically."
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
          <div className="grid gap-2">
            <Label htmlFor="reassign-select">Nurse</Label>
            <select
              id="reassign-select"
              data-testid="reassign-select"
              ref={selectRef}
              value={selectedNurseUserId}
              onChange={(event) => setSelectedNurseUserId(event.target.value)}
              disabled={isSubmitting || nurseCandidates.length === 0}
              className="min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm ring-offset-background"
            >
              {nurseCandidates.length === 0 && <option value="">No nurse candidates</option>}
              {nurseCandidates.map((candidate) => (
                <option key={candidate.userId} value={candidate.userId}>
                  {candidate.email} ({candidate.isAvailable ? "available" : "busy"}) [{candidate.userId.slice(0, 8)}]
                </option>
              ))}
            </select>
          </div>

          <Button
            type="button"
            onClick={() => {
              const latestSelected = selectRef.current?.value ?? selectedNurseUserId;
              void submitReassignment(latestSelected || null);
            }}
            disabled={isSubmitting || nurseCandidates.length === 0 || !selectedNurseUserId}
          >
            Assign Selected Nurse
          </Button>

          <Button
            type="button"
            onClick={() => void submitReassignment(null)}
            disabled={isSubmitting}
            variant="outline"
          >
            Unassign Request
          </Button>
        </div>

        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 sm:grid-cols-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected nurse</div>
            <div className="mt-1 font-medium text-slate-950">
              {selectedNurse?.email ?? "No nurse selected"}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Eligibility</div>
            <div className="mt-1 capitalize">
              {selectedNurse ? `${selectedNurse.status} • ${selectedNurse.isAvailable ? "available" : "busy"}` : "-"}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">License valid until</div>
            <div className="mt-1">
              {selectedNurse?.licenseValidUntil
                ? new Date(selectedNurse.licenseValidUntil).toLocaleString()
                : "No expiry on file"}
            </div>
          </div>
        </div>

        <div
          data-testid="reassign-feedback"
          aria-live="polite"
          className={[
            "mt-3 min-h-10 rounded-lg border px-4 py-3 text-sm",
            feedback?.tone === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : feedback?.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-dashed border-slate-200 bg-slate-50 text-slate-500",
          ].join(" ")}
        >
          {feedback?.message ?? "Assignment feedback appears here after triage actions run."}
        </div>
      </AdminSectionCard>
    </div>
  );
}
