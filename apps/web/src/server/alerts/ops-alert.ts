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

export function notifyOpsAlert(input: OpsAlertInput) {
  const webhookUrl = process.env.OPS_ALERT_WEBHOOK_URL;
  if (!webhookUrl || !isOpsAlertAction(input.action)) {
    return;
  }

  const startedAt = Date.now();
  const timestamp = new Date().toISOString();

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

      logApiFailure(
        {
          requestId: `ops_alert_${input.requestId}`,
          route: "ops.alert",
          method: "POST",
          action: "ops.alert.webhook",
          actorId: input.actorUserId,
          actorRole: "admin",
        },
        new Error(`Ops alert webhook returned ${response.status}`),
        response.status,
        startedAt,
        {
          source: "ops.alert",
          alertAction: input.action,
        },
      );
    })
    .catch((error) => {
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
        502,
        startedAt,
        {
          source: "ops.alert",
          alertAction: input.action,
        },
      );
    });
}
