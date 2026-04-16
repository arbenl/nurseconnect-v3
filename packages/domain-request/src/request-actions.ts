import type { RequestEventType, RequestStatus } from "@nurseconnect/contracts";
import type { DbClient } from "@nurseconnect/database";
import { serviceRequests } from "@nurseconnect/database/schema";
import { eq, sql } from "drizzle-orm";

import {
  RequestConflictError,
  RequestForbiddenError,
  RequestNotFoundError,
} from "./errors";
import { appendRequestEvent } from "./request-events";
import { canTransition, type RequestAction } from "./request-lifecycle";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

type LockedRequestRow = {
  id: string;
  status: RequestStatus;
  patient_user_id: string;
  assigned_nurse_user_id: string | null;
  assigned_at: Date | null;
};

export type RequestSideEffect = {
  type: "set-nurse-availability";
  userId: string;
  isAvailable: boolean;
};

export type ApplyRequestActionInput = {
  requestId: string;
  actorUserId: string;
  action: RequestAction;
  actorHasNurseProfile?: boolean;
  reason?: string;
};

export type ApplyRequestActionResult = {
  request: typeof serviceRequests.$inferSelect;
  event: {
    requestId: string;
    type: RequestEventType;
    actorUserId: string;
    fromStatus: RequestStatus;
    toStatus: RequestStatus;
    meta: Record<string, unknown> | null;
  };
  sideEffects: RequestSideEffect[];
};

const nurseActions = new Set<RequestAction>([
  "accept",
  "reject",
  "enroute",
  "complete",
]);

const requestActionEventType: Record<RequestAction, RequestEventType> = {
  accept: "request_accepted",
  reject: "request_rejected",
  enroute: "request_enroute",
  complete: "request_completed",
  cancel: "request_canceled",
};

export async function applyRequestAction(
  tx: Transaction,
  input: ApplyRequestActionInput,
): Promise<ApplyRequestActionResult> {
  const { requestId, actorUserId, action } = input;

  const lockResult = await tx.execute<LockedRequestRow>(sql`
      SELECT id,
             status::text as status,
             patient_user_id,
             assigned_nurse_user_id,
             assigned_at
      FROM service_requests
      WHERE id = ${requestId}
      FOR UPDATE
    `);

  const locked = lockResult.rows[0];
  if (!locked) {
    throw new RequestNotFoundError();
  }

  if (action === "cancel") {
    if (locked.patient_user_id !== actorUserId) {
      throw new RequestForbiddenError("Only the patient can cancel this request");
    }
  } else if (nurseActions.has(action)) {
    if (locked.assigned_nurse_user_id !== actorUserId) {
      throw new RequestForbiddenError(
        "Only the assigned nurse can perform this action",
      );
    }

    if (!input.actorHasNurseProfile) {
      throw new RequestForbiddenError("Nurse profile is required");
    }
  }

  let nextStatus: RequestStatus;
  try {
    nextStatus = canTransition(locked.status, action);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid request transition";
    throw new RequestConflictError(message);
  }

  if (locked.status === nextStatus) {
    throw new RequestConflictError(`Request is already in status '${nextStatus}'`);
  }

  const now = new Date();
  const updateData: Partial<typeof serviceRequests.$inferInsert> = {
    status: nextStatus,
    updatedAt: now,
  };
  const sideEffects: RequestSideEffect[] = [];

  switch (action) {
    case "accept":
      updateData.acceptedAt = now;
      if (!locked.assigned_at) {
        updateData.assignedAt = now;
      }
      sideEffects.push({
        type: "set-nurse-availability",
        userId: actorUserId,
        isAvailable: false,
      });
      break;
    case "reject":
      updateData.status = "open";
      updateData.assignedNurseUserId = null;
      updateData.rejectedAt = now;
      sideEffects.push({
        type: "set-nurse-availability",
        userId: actorUserId,
        isAvailable: true,
      });
      break;
    case "enroute":
      updateData.enrouteAt = now;
      break;
    case "complete":
      updateData.completedAt = now;
      sideEffects.push({
        type: "set-nurse-availability",
        userId: actorUserId,
        isAvailable: true,
      });
      break;
    case "cancel":
      updateData.canceledAt = now;
      if (locked.assigned_nurse_user_id) {
        sideEffects.push({
          type: "set-nurse-availability",
          userId: locked.assigned_nurse_user_id,
          isAvailable: true,
        });
      }
      break;
  }

  const [updated] = await tx
    .update(serviceRequests)
    .set(updateData)
    .where(eq(serviceRequests.id, requestId))
    .returning();

  if (!updated) {
    throw new RequestNotFoundError();
  }

  const event = {
    requestId,
    type: requestActionEventType[action],
    actorUserId,
    fromStatus: locked.status,
    toStatus: nextStatus,
    meta:
      action === "reject" && input.reason !== undefined
        ? { reason: input.reason }
        : null,
  };

  await appendRequestEvent(tx, event);

  return {
    request: updated,
    event,
    sideEffects,
  };
}
