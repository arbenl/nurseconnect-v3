"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type NurseCandidate = {
  userId: string;
  email: string;
  isAvailable: boolean;
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
    <section
      data-testid="reassign-panel"
      data-hydrated={isHydrated ? "true" : "false"}
      style={{
        border: "1px solid #333",
        borderRadius: "8px",
        padding: "1rem",
      }}
    >
      <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>Triage Actions</h2>
      <p style={{ opacity: 0.7, fontSize: "0.85rem", marginBottom: "0.75rem" }}>
        Reassign requests without exposing PHI fields. Availability is updated automatically.
      </p>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <label htmlFor="reassign-select" style={{ fontSize: "0.85rem" }}>
          Nurse
        </label>
        <select
          id="reassign-select"
          data-testid="reassign-select"
          ref={selectRef}
          value={selectedNurseUserId}
          onChange={(event) => setSelectedNurseUserId(event.target.value)}
          disabled={isSubmitting || nurseCandidates.length === 0}
          style={{
            minWidth: "320px",
            padding: "8px",
            borderRadius: "4px",
            border: "1px solid #333",
            background: "#000",
            color: "#fff",
          }}
        >
          {nurseCandidates.length === 0 && <option value="">No nurse candidates</option>}
          {nurseCandidates.map((candidate) => (
            <option key={candidate.userId} value={candidate.userId}>
              {candidate.email} ({candidate.isAvailable ? "available" : "busy"}) [{candidate.userId.slice(0, 8)}]
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => {
            const latestSelected = selectRef.current?.value ?? selectedNurseUserId;
            void submitReassignment(latestSelected || null);
          }}
          disabled={isSubmitting || nurseCandidates.length === 0 || !selectedNurseUserId}
          style={{
            padding: "8px 12px",
            borderRadius: "4px",
            border: "1px solid #2f6f44",
            background: "#103420",
            color: "#d7ffe6",
            cursor: isSubmitting ? "not-allowed" : "pointer",
          }}
        >
          Assign Selected Nurse
        </button>

        <button
          type="button"
          onClick={() => void submitReassignment(null)}
          disabled={isSubmitting}
          style={{
            padding: "8px 12px",
            borderRadius: "4px",
            border: "1px solid #704040",
            background: "#2f1717",
            color: "#ffd8d8",
            cursor: isSubmitting ? "not-allowed" : "pointer",
          }}
        >
          Unassign Request
        </button>
      </div>

      <div
        data-testid="reassign-feedback"
        style={{
          minHeight: "1.5rem",
          marginTop: "0.75rem",
          fontSize: "0.85rem",
          color: feedback?.tone === "error" ? "#ff8a8a" : "#9dffbc",
        }}
        aria-live="polite"
      >
        {feedback?.message ?? ""}
      </div>
    </section>
  );
}
