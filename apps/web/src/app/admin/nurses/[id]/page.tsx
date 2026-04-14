"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type QueueItem = {
  id: string;
  userId: string;
  status: string;
  licenseNumber: string | null;
  licenseJurisdiction: string | null;
  specialization: string | null;
  updatedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

type FeedbackState = {
  tone: "success" | "error";
  message: string;
} | null;

export default function AdminNurseDetailPage() {
  const params = useParams<{ id: string }>();
  const nurseId = params.id;
  const router = useRouter();
  const [nurse, setNurse] = useState<QueueItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [validUntil, setValidUntil] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [reason, setReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const loadNurse = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/nurses");
      const data = await res.json();
      if (data.items) {
        const item = data.items.find((i: QueueItem) => i.id === nurseId);
        if (item) {
          setNurse(item);
          setJurisdiction(item.licenseJurisdiction || "");
        }
      }
    } finally {
      setLoading(false);
    }
  }, [nurseId]);

  useEffect(() => {
    void loadNurse();
  }, [loadNurse]);

  const onVerify = async () => {
    if (!validUntil) {
      setFeedback({ tone: "error", message: "Valid until date is required." });
      return;
    }
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/nurses/${nurseId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseValidUntil: new Date(validUntil).toISOString(),
          licenseJurisdiction: jurisdiction || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : "Failed to verify");
      }
      setFeedback({
        tone: "success",
        message: "Nurse verified and promoted into the dispatchable supply pool.",
      });
      await loadNurse();
      router.refresh();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setActionLoading(false);
    }
  };

  const onReject = async () => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/nurses/${nurseId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : "Failed to reject");
      }
      setFeedback({ tone: "success", message: "Application rejected. The user remains in patient mode." });
      await loadNurse();
      router.refresh();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setActionLoading(false);
    }
  };

  const onSuspend = async () => {
    if (!reason) {
      setFeedback({ tone: "error", message: "Suspend reason is required." });
      return;
    }
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/nurses/${nurseId}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : "Failed to suspend");
      }
      setFeedback({
        tone: "success",
        message: "Nurse suspended and removed from new dispatches.",
      });
      await loadNurse();
      router.refresh();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="container py-8">Loading...</div>;
  if (!nurse) return <div className="container py-8">Nurse not found.</div>;

  return (
    <div className="container py-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Review Application</h1>
        <p className="text-muted-foreground mt-2">
          Verify credentials for {nurse.user.name || nurse.user.email}
        </p>
      </div>

      <AdminSectionCard
        title="Profile details"
        description="Submitted nurse credential information and identity context."
      >
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">Current status</div>
          <Badge variant="outline" className="uppercase">
            {nurse.status}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-muted-foreground">User ID</Label>
            <div className="font-mono text-sm">{nurse.userId}</div>
          </div>
          <div>
            <Label className="text-muted-foreground">Nurse ID</Label>
            <div className="font-mono text-sm">{nurse.id}</div>
          </div>
          <div>
            <Label className="text-muted-foreground">Name</Label>
            <div>{nurse.user.name || "N/A"}</div>
          </div>
          <div>
            <Label className="text-muted-foreground">Email</Label>
            <div>{nurse.user.email}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 border-t pt-4">
          <div>
            <Label className="text-muted-foreground">License Number</Label>
            <div className="font-mono">{nurse.licenseNumber || "N/A"}</div>
          </div>
          <div>
            <Label className="text-muted-foreground">Specialization</Label>
            <div>{nurse.specialization || "N/A"}</div>
          </div>
        </div>
      </AdminSectionCard>

      <AdminSectionCard
        title="Verification Action"
        description="Approve, reject, or suspend this applicant with in-page feedback."
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
          {feedback?.message ?? "Actions render feedback here instead of using browser alerts."}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="jurisdiction">License Jurisdiction (State/Region)</Label>
          <Input id="jurisdiction" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="validUntil">License Valid Until</Label>
          <Input id="validUntil" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </div>
        <div className="grid gap-2 border-t pt-4">
          <Label htmlFor="reason">Reject / Suspend Reason</Label>
          <Input
            id="reason"
            placeholder="Required for suspension, optional for rejection"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2 border-t pt-6">
          <Button onClick={onVerify} disabled={actionLoading} className="bg-green-600 hover:bg-green-700">
            {actionLoading ? "Submitting..." : "Verify & Approve"}
          </Button>
          <Button onClick={onReject} disabled={actionLoading} variant="outline" className="text-red-600 border-red-200">
            {actionLoading ? "Submitting..." : "Reject"}
          </Button>
          <Button onClick={onSuspend} disabled={actionLoading} variant="destructive">
            {actionLoading ? "Submitting..." : "Suspend"}
          </Button>
          <Button variant="ghost" onClick={() => router.push("/admin/nurses")} disabled={actionLoading}>
            Back to queue
          </Button>
        </div>
      </AdminSectionCard>
    </div>
  );
}
