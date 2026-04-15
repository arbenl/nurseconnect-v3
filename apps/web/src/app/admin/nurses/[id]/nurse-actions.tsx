"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type NurseActionsProps = {
  nurseId: string;
  initialJurisdiction: string;
  initialValidUntil: string;
  initialStatus: string;
};

type FeedbackState = {
  tone: "success" | "error";
  message: string;
} | null;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

export function NurseActions({
  nurseId,
  initialJurisdiction,
  initialValidUntil,
  initialStatus,
}: NurseActionsProps) {
  const router = useRouter();
  const [jurisdiction, setJurisdiction] = useState(initialJurisdiction);
  const [validUntil, setValidUntil] = useState(initialValidUntil);
  const [reason, setReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  async function runAction(
    path: string,
    body: Record<string, unknown>,
    successMessage: string,
  ) {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const responseBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof responseBody?.error === "string" ? responseBody.error : "Action failed",
        );
      }
      setFeedback({ tone: "success", message: successMessage });
      router.refresh();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <AdminSectionCard
      title="Verification actions"
      description="Approve, reject, or suspend this nurse with inline feedback."
      className="mt-0"
    >
      <div
        data-testid="credential-review-panel"
        data-hydrated={isHydrated ? "true" : "false"}
        className="space-y-4"
      >
        <div
          data-testid="credential-review-feedback"
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
          {feedback?.message ??
          `Current state: ${initialStatus}. Actions render feedback here instead of using browser alerts.`}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="jurisdiction">License jurisdiction</Label>
            <Input
              id="jurisdiction"
              value={jurisdiction}
              onChange={(event) => setJurisdiction(event.target.value)}
              disabled={!isHydrated || actionLoading}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="validUntil">License valid until</Label>
            <Input
              id="validUntil"
              type="date"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
              disabled={!isHydrated || actionLoading}
            />
          </div>
        </div>

        <div className="grid gap-2 border-t border-slate-100 pt-4">
          <Label htmlFor="reason">Reject / suspend reason</Label>
          <Input
            id="reason"
            placeholder="Required for suspension, optional for rejection"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={!isHydrated || actionLoading}
          />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-6">
          <Button
            onClick={() => {
              if (!validUntil) {
                setFeedback({ tone: "error", message: "Valid until date is required." });
                return;
              }
              void runAction(
                `/api/admin/nurses/${nurseId}/verify`,
                {
                  licenseValidUntil: new Date(validUntil).toISOString(),
                  licenseJurisdiction: jurisdiction || undefined,
                },
                "Nurse verified and promoted into the dispatchable supply pool.",
              );
            }}
            disabled={!isHydrated || actionLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {actionLoading ? "Submitting..." : "Verify & approve"}
          </Button>

          <Button
            onClick={() =>
              void runAction(
                `/api/admin/nurses/${nurseId}/reject`,
                { reason: reason || undefined },
                "Application rejected. The user remains in patient mode.",
              )
            }
            disabled={!isHydrated || actionLoading}
            variant="outline"
            className="border-red-200 text-red-600"
          >
            {actionLoading ? "Submitting..." : "Reject"}
          </Button>

          <Button
            onClick={() => {
              if (!reason) {
                setFeedback({ tone: "error", message: "Suspend reason is required." });
                return;
              }
              void runAction(
                `/api/admin/nurses/${nurseId}/suspend`,
                { reason },
                "Nurse suspended and removed from new dispatches.",
              );
            }}
            disabled={!isHydrated || actionLoading}
            variant="destructive"
          >
            {actionLoading ? "Submitting..." : "Suspend"}
          </Button>
        </div>
      </div>
    </AdminSectionCard>
  );
}
