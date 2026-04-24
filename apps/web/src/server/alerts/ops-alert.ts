import type { AdminAuditAction } from "@/server/admin/audit";
import { logApiFailure } from "@/server/telemetry/ops-logger";

const ALERT_ACTIONS = new Set<AdminAuditAction>([
  "payment.authorization.failed",
  "payout.failed",
]);

export type OpsAlertInput = {
  action: AdminAuditAction;
  requestId: string;
  actorUserId: string;
};

export function isOpsAlertAction(action: AdminAuditAction) {
  return ALERT_ACTIONS.has(action);
}

function logAlertFailure(
  input: OpsAlertInput,
  error: unknown,
  status: number,
  startedAt: number,
) {
  logApiFailure(
    {
      requestId: `ops_alert_${input.requestId}`,
      route: "ops.alert",
      method: "POST",
      action: "ops.alert.webhook",
      actorId: input.actorUserId,
      actorRole: "admin",
    },
    error,
    status,
    startedAt,
    {
      source: "ops.alert",
      alertAction: input.action,
    },
  );
}

export function notifyOpsAlert(input: OpsAlertInput) {
  const webhookUrl = process.env.OPS_ALERT_WEBHOOK_URL?.trim();
  if (!webhookUrl || !isOpsAlertAction(input.action)) {
    return;
  }

  const startedAt = Date.now();
  const timestamp = new Date().toISOString();

  try {
    void fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: input.action,
        requestId: input.requestId,
        actorUserId: input.actorUserId,
        timestamp,
        details: {
          source: "admin.request.paymentTrace",
        },
      }),
    })
      .then((response) => {
        if (response.ok) {
          return;
        }

        logAlertFailure(
          input,
          new Error(`Ops alert webhook returned ${response.status}`),
          response.status,
          startedAt,
        );
      })
      .catch((error) => {
        logAlertFailure(input, error, 502, startedAt);
      });
  } catch (error) {
    logAlertFailure(input, error, 502, startedAt);
  }
}
