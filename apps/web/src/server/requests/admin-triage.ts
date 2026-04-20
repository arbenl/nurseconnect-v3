import type { AdminTriageAction, RequestStatus } from "@nurseconnect/contracts";
import { db, eq, schema } from "@nurseconnect/database";
import {
  applyAdminTriageAction as applyAdminTriageActionInDomain,
  type ApplyAdminTriageActionInput,
} from "@nurseconnect/domain-request";

import { recordAdminAction, type AdminAuditAction } from "@/server/admin/audit";

const { nurses } = schema;

const adminTriageAuditAction: Record<AdminTriageAction, AdminAuditAction> = {
  needs_review: "request.needs_review",
  decline: "request.declined",
  unfulfilled: "request.unfulfilled",
  reopen: "request.reopened",
};

function normalizeReason(reason: string | undefined) {
  const trimmed = reason?.trim();
  return trimmed ? trimmed : null;
}

export async function applyAdminTriageAction(input: ApplyAdminTriageActionInput) {
  return db.transaction(async (tx) => {
    const result = await applyAdminTriageActionInDomain(tx, input);

    for (const sideEffect of result.sideEffects) {
      if (sideEffect.type === "set-nurse-availability") {
        await tx
          .update(nurses)
          .set({
            isAvailable: sideEffect.isAvailable,
            updatedAt: new Date(),
          })
          .where(eq(nurses.userId, sideEffect.userId));
      }
    }

    await recordAdminAction(
      {
        actorUserId: input.actorUserId,
        action: adminTriageAuditAction[input.action],
        targetEntityType: "request",
        targetEntityId: input.requestId,
        details: {
          requestId: input.requestId,
          action: input.action,
          reason: normalizeReason(input.reason),
          previousStatus: result.event.fromStatus as RequestStatus,
          nextStatus: result.event.toStatus as RequestStatus,
        },
      },
      tx,
    );

    return result.request;
  });
}

export {
  RequestConflictError,
  RequestForbiddenError,
  RequestNotFoundError,
} from "@nurseconnect/domain-request";
