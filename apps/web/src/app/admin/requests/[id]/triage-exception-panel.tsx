"use client";

import type { AdminTriageAction, RequestStatus } from "@nurseconnect/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type TriageExceptionPanelProps = {
  requestId: string;
  status: RequestStatus;
};

type FeedbackState = {
  tone: "success" | "error";
  message: string;
} | null;

type ActionOption = {
  action: AdminTriageAction;
  label: string;
  requiresReason: boolean;
};

function getAvailableActions(status: RequestStatus): ActionOption[] {
  const options: ActionOption[] = [];

  if (status === "open" || status === "assigned") {
    options.push({
      action: "needs_review",
      label: "Mark Needs Review",
      requiresReason: false,
    });
  }

  if (status === "open" || status === "assigned" || status === "needs_review") {
    options.push(
      {
        action: "decline",
        label: "Decline Request",
        requiresReason: true,
      },
      {
        action: "unfulfilled",
        label: "Mark Unfulfilled",
        requiresReason: true,
      },
    );
  }

  if (status === "needs_review" || status === "declined" || status === "unfulfilled") {
    options.push({
      action: "reopen",
      label: "Reopen Request",
      requiresReason: false,
    });
  }

  return options;
}

function successMessage(action: AdminTriageAction) {
  switch (action) {
    case "needs_review":
      return "Request moved to exception review.";
    case "decline":
      return "Request declined.";
    case "unfulfilled":
      return "Request marked unfulfilled.";
    case "reopen":
      return "Request reopened.";
  }
}

export default function TriageExceptionPanel({
  requestId,
  status,
}: TriageExceptionPanelProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);
  const [pendingAction, setPendingAction] = useState<AdminTriageAction | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const actions = useMemo(() => getAvailableActions(status), [status]);
  const trimmedReason = reason.trim();

  async function submitAction(option: ActionOption) {
    setPendingAction(option.action);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/requests/${requestId}/triage`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: option.action,
          reason: trimmedReason || undefined,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message =
          typeof body?.error === "string" ? body.error : `Request failed with status ${response.status}`;
        setFeedback({ tone: "error", message });
        return;
      }

      setFeedback({ tone: "success", message: successMessage(option.action) });
      setReason("");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setFeedback({ tone: "error", message });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <AdminSectionCard
      title="Exception Actions"
      description="Move requests into or out of admin exception states with an auditable reason."
    >
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="triage-reason">Reason</Label>
          <textarea
            id="triage-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={!isHydrated || pendingAction !== null}
            maxLength={1000}
            rows={3}
            className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm ring-offset-background"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {actions.map((option) => {
            const disabled =
              !isHydrated ||
              pendingAction !== null ||
              (option.requiresReason && trimmedReason.length < 3);

            return (
              <Button
                key={option.action}
                type="button"
                variant={option.action === "reopen" ? "outline" : "default"}
                disabled={disabled}
                onClick={() => void submitAction(option)}
              >
                {pendingAction === option.action ? "Saving..." : option.label}
              </Button>
            );
          })}
          {actions.length === 0 ? (
            <span className="text-sm text-slate-500">No exception actions are available for this status.</span>
          ) : null}
        </div>

        <div
          aria-live="polite"
          className={[
            "min-h-10 rounded-lg border px-4 py-3 text-sm",
            feedback?.tone === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : feedback?.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-dashed border-slate-200 bg-slate-50 text-slate-500",
          ].join(" ")}
        >
          {feedback?.message ?? "Exception action feedback appears here after an update."}
        </div>
      </div>
    </AdminSectionCard>
  );
}
