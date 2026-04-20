"use client";

import type {
  AdminRequestPaymentTrace,
  PaymentAuthorizationAction,
  RequestStatus,
} from "@nurseconnect/contracts";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type PaymentTracePanelProps = {
  requestId: string;
  requestStatus: RequestStatus;
  assignedNurseUserId: string | null;
  trace: AdminRequestPaymentTrace;
};

type FeedbackState = {
  tone: "success" | "error";
  message: string;
} | null;

type AuthorizationMutation =
  | {
      kind: "authorization";
      action: "record";
      amountCents: number;
      currency: string;
      provider?: string;
      providerReference?: string;
      note?: string;
    }
  | {
      kind: "authorization";
      action: PaymentAuthorizationAction;
      providerReference?: string;
      failureReason?: string;
      note?: string;
    };

type PayoutMutation =
  | {
      kind: "payout";
      action: "record";
      nurseUserId: string;
      amountCents: number;
      currency: string;
      provider?: string;
      providerReference?: string;
      note?: string;
    }
  | {
      kind: "payout";
      action: "mark_paid" | "fail" | "cancel";
      providerReference?: string;
      failureReason?: string;
      note?: string;
    };

function formatMoney(amountCents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "-";
}

function clean(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function toCents(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return 0;
  }
  return Math.round(Number(normalized) * 100);
}

export default function PaymentTracePanel({
  requestId,
  requestStatus,
  assignedNurseUserId,
  trace,
}: PaymentTracePanelProps) {
  const router = useRouter();
  const [authAmount, setAuthAmount] = useState("");
  const [authCurrency, setAuthCurrency] = useState("USD");
  const [authProvider, setAuthProvider] = useState("manual");
  const [authReference, setAuthReference] = useState("");
  const [authFailureReason, setAuthFailureReason] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutCurrency, setPayoutCurrency] = useState("USD");
  const [payoutProvider, setPayoutProvider] = useState("manual");
  const [payoutReference, setPayoutReference] = useState("");
  const [payoutFailureReason, setPayoutFailureReason] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const canRecordPayout = useMemo(
    () => requestStatus === "completed" && Boolean(assignedNurseUserId),
    [assignedNurseUserId, requestStatus],
  );

  async function submitMutation(
    actionLabel: string,
    payload: AuthorizationMutation | PayoutMutation,
  ) {
    setPendingAction(actionLabel);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/requests/${requestId}/payments`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message =
          typeof body?.error === "string"
            ? body.error
            : `Request failed with status ${response.status}`;
        setFeedback({ tone: "error", message });
        return;
      }

      setFeedback({ tone: "success", message: "Payment trace updated." });
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setFeedback({ tone: "error", message });
    } finally {
      setPendingAction(null);
    }
  }

  const authAmountCents = toCents(authAmount);
  const payoutAmountCents = toCents(payoutAmount);
  const authTerminal =
    trace.authorization?.status === "captured" ||
    trace.authorization?.status === "voided" ||
    trace.authorization?.status === "failed";
  const payoutTerminal =
    trace.payout?.status === "paid" ||
    trace.payout?.status === "failed" ||
    trace.payout?.status === "canceled";

  return (
    <AdminSectionCard
      title="Payment Trace"
      description="Private-pay authorization and nurse payout records for launch auditability."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-slate-900">Private Pay Authorization</h2>
            {trace.authorization ? (
              <dl className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                <div>
                  <dt className="font-medium">Status</dt>
                  <dd className="capitalize">{trace.authorization.status}</dd>
                </div>
                <div>
                  <dt className="font-medium">Amount</dt>
                  <dd>{formatMoney(trace.authorization.amountCents, trace.authorization.currency)}</dd>
                </div>
                <div>
                  <dt className="font-medium">Reference</dt>
                  <dd>{trace.authorization.providerReference ?? "-"}</dd>
                </div>
                <div>
                  <dt className="font-medium">Captured</dt>
                  <dd>{formatDate(trace.authorization.capturedAt)}</dd>
                </div>
              </dl>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="auth-amount">Amount</Label>
                  <input
                    id="auth-amount"
                    value={authAmount}
                    onChange={(event) => setAuthAmount(event.target.value)}
                    inputMode="decimal"
                    className="rounded-md border border-input px-3 py-2 text-sm"
                    placeholder="150.00"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="auth-currency">Currency</Label>
                  <input
                    id="auth-currency"
                    value={authCurrency}
                    onChange={(event) => setAuthCurrency(event.target.value.toUpperCase())}
                    maxLength={3}
                    className="rounded-md border border-input px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="auth-provider">Provider</Label>
                  <input
                    id="auth-provider"
                    value={authProvider}
                    onChange={(event) => setAuthProvider(event.target.value)}
                    className="rounded-md border border-input px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="auth-reference">Reference</Label>
                  <input
                    id="auth-reference"
                    value={authReference}
                    onChange={(event) => setAuthReference(event.target.value)}
                    className="rounded-md border border-input px-3 py-2 text-sm"
                  />
                </div>
                <Button
                  type="button"
                  disabled={pendingAction !== null || authAmountCents <= 0}
                  onClick={() =>
                    void submitMutation("authorization.record", {
                      kind: "authorization",
                      action: "record",
                      amountCents: authAmountCents,
                      currency: authCurrency,
                      provider: clean(authProvider),
                      providerReference: clean(authReference),
                    })
                  }
                >
                  {pendingAction === "authorization.record" ? "Saving..." : "Record Authorization"}
                </Button>
              </div>
            )}
          </div>

          {trace.authorization && !authTerminal ? (
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="auth-status-reference">Reference</Label>
                <input
                  id="auth-status-reference"
                  value={authReference}
                  onChange={(event) => setAuthReference(event.target.value)}
                  className="rounded-md border border-input px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="auth-failure">Failure Reason</Label>
                <input
                  id="auth-failure"
                  value={authFailureReason}
                  onChange={(event) => setAuthFailureReason(event.target.value)}
                  className="rounded-md border border-input px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={pendingAction !== null}
                  onClick={() =>
                    void submitMutation("authorization.capture", {
                      kind: "authorization",
                      action: "capture",
                      providerReference: clean(authReference),
                    })
                  }
                >
                  {pendingAction === "authorization.capture" ? "Saving..." : "Capture"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pendingAction !== null}
                  onClick={() =>
                    void submitMutation("authorization.void", {
                      kind: "authorization",
                      action: "void",
                    })
                  }
                >
                  Void
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pendingAction !== null || authFailureReason.trim().length < 3}
                  onClick={() =>
                    void submitMutation("authorization.fail", {
                      kind: "authorization",
                      action: "fail",
                      failureReason: authFailureReason,
                    })
                  }
                >
                  Fail
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-slate-900">Nurse Payout</h2>
            {trace.payout ? (
              <dl className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                <div>
                  <dt className="font-medium">Status</dt>
                  <dd className="capitalize">{trace.payout.status}</dd>
                </div>
                <div>
                  <dt className="font-medium">Amount</dt>
                  <dd>{formatMoney(trace.payout.amountCents, trace.payout.currency)}</dd>
                </div>
                <div>
                  <dt className="font-medium">Reference</dt>
                  <dd>{trace.payout.providerReference ?? "-"}</dd>
                </div>
                <div>
                  <dt className="font-medium">Paid</dt>
                  <dd>{formatDate(trace.payout.paidAt)}</dd>
                </div>
              </dl>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="payout-amount">Amount</Label>
                  <input
                    id="payout-amount"
                    value={payoutAmount}
                    onChange={(event) => setPayoutAmount(event.target.value)}
                    inputMode="decimal"
                    className="rounded-md border border-input px-3 py-2 text-sm"
                    placeholder="90.00"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="payout-currency">Currency</Label>
                  <input
                    id="payout-currency"
                    value={payoutCurrency}
                    onChange={(event) => setPayoutCurrency(event.target.value.toUpperCase())}
                    maxLength={3}
                    className="rounded-md border border-input px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="payout-provider">Provider</Label>
                  <input
                    id="payout-provider"
                    value={payoutProvider}
                    onChange={(event) => setPayoutProvider(event.target.value)}
                    className="rounded-md border border-input px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="payout-reference">Reference</Label>
                  <input
                    id="payout-reference"
                    value={payoutReference}
                    onChange={(event) => setPayoutReference(event.target.value)}
                    className="rounded-md border border-input px-3 py-2 text-sm"
                  />
                </div>
                <Button
                  type="button"
                  disabled={pendingAction !== null || !canRecordPayout || payoutAmountCents <= 0}
                  onClick={() =>
                    assignedNurseUserId
                      ? void submitMutation("payout.record", {
                          kind: "payout",
                          action: "record",
                          nurseUserId: assignedNurseUserId,
                          amountCents: payoutAmountCents,
                          currency: payoutCurrency,
                          provider: clean(payoutProvider),
                          providerReference: clean(payoutReference),
                        })
                      : undefined
                  }
                >
                  {pendingAction === "payout.record" ? "Saving..." : "Record Payout Owed"}
                </Button>
              </div>
            )}
          </div>

          {trace.payout && !payoutTerminal ? (
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="payout-status-reference">Reference</Label>
                <input
                  id="payout-status-reference"
                  value={payoutReference}
                  onChange={(event) => setPayoutReference(event.target.value)}
                  className="rounded-md border border-input px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="payout-failure">Failure Reason</Label>
                <input
                  id="payout-failure"
                  value={payoutFailureReason}
                  onChange={(event) => setPayoutFailureReason(event.target.value)}
                  className="rounded-md border border-input px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={pendingAction !== null}
                  onClick={() =>
                    void submitMutation("payout.mark_paid", {
                      kind: "payout",
                      action: "mark_paid",
                      providerReference: clean(payoutReference),
                    })
                  }
                >
                  {pendingAction === "payout.mark_paid" ? "Saving..." : "Mark Paid"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pendingAction !== null || payoutFailureReason.trim().length < 3}
                  onClick={() =>
                    void submitMutation("payout.fail", {
                      kind: "payout",
                      action: "fail",
                      failureReason: payoutFailureReason,
                    })
                  }
                >
                  Fail
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pendingAction !== null}
                  onClick={() =>
                    void submitMutation("payout.cancel", {
                      kind: "payout",
                      action: "cancel",
                    })
                  }
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <div
        aria-live="polite"
        className={[
          "mt-5 min-h-10 rounded-lg border px-4 py-3 text-sm",
          feedback?.tone === "error"
            ? "border-red-200 bg-red-50 text-red-700"
            : feedback?.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-dashed border-slate-200 bg-slate-50 text-slate-500",
        ].join(" ")}
      >
        {feedback?.message ?? "Payment trace feedback appears here after an update."}
      </div>
    </AdminSectionCard>
  );
}
