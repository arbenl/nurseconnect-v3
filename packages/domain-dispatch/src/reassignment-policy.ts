import type { RequestStatus } from "@nurseconnect/contracts";
import type { DbClient } from "@nurseconnect/database";
import { nurses, serviceRequests } from "@nurseconnect/database/schema";
import { RequestNotFoundError, appendRequestEvent } from "@nurseconnect/domain-request";
import { eq, sql } from "drizzle-orm";

import {
  RequestReassignForbiddenError,
  RequestReassignValidationError,
} from "./errors";
import { validateDispatchEligibleNurse } from "./assignment-policy";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

type LockedRequestRow = {
  id: string;
  status: string;
  assignedNurseUserId: string | null;
  assignedAt: Date | string | null;
};

export function deriveReassignmentPlan(input: {
  currentStatus: "open" | "assigned";
  previousNurseUserId: string | null;
  nextNurseUserId: string | null;
}) {
  const isPreviouslyAssigned = input.currentStatus === "assigned";
  const isReassignToSameNurse =
    isPreviouslyAssigned &&
    input.nextNurseUserId !== null &&
    input.nextNurseUserId === input.previousNurseUserId;

  return {
    nextStatus: input.nextNurseUserId ? "assigned" : "open",
    shouldReleasePreviousNurse:
      isPreviouslyAssigned &&
      input.previousNurseUserId !== null &&
      input.previousNurseUserId !== input.nextNurseUserId,
    shouldAssignNewNurse:
      input.nextNurseUserId !== null &&
      (!isPreviouslyAssigned || input.nextNurseUserId !== input.previousNurseUserId),
    shouldRefreshAssignedAt:
      input.nextNurseUserId !== null && !isReassignToSameNurse,
  } as const;
}

export async function reassignRequestInDispatch(
  tx: Transaction,
  input: {
    requestId: string;
    actorUserId: string;
    nurseUserId: string | null;
  },
) {
  const { requestId, actorUserId, nurseUserId } = input;

  const requestRows = await tx.execute<LockedRequestRow>(sql`
    SELECT id,
           status::text as status,
           assigned_nurse_user_id as "assignedNurseUserId",
           assigned_at as "assignedAt"
    FROM service_requests
    WHERE id = ${requestId}
    FOR UPDATE
  `);

  const request = requestRows.rows[0];
  if (!request) {
    throw new RequestNotFoundError();
  }

  const normalizedStatus = request.status.toLowerCase();
  if (!["open", "assigned"].includes(normalizedStatus)) {
    throw new RequestReassignForbiddenError(
      "Only open or assigned requests can be reassigned",
    );
  }

  if (nurseUserId !== null) {
    try {
      await validateDispatchEligibleNurse(tx, nurseUserId);
    } catch (error) {
      if (error instanceof Error) {
        throw new RequestReassignValidationError(error.message);
      }
      throw error;
    }
  }

  const previousNurseUserId = request.assignedNurseUserId;
  const previousAssignedAt =
    request.assignedAt instanceof Date
      ? request.assignedAt
      : request.assignedAt
        ? new Date(request.assignedAt)
        : null;
  const previousStatus = request.status as RequestStatus;
  const plan = deriveReassignmentPlan({
    currentStatus: normalizedStatus as "open" | "assigned",
    previousNurseUserId,
    nextNurseUserId: nurseUserId,
  });
  const now = new Date();
  const nextAssignedAt =
    nurseUserId === null
      ? null
      : plan.shouldRefreshAssignedAt
        ? now
        : previousAssignedAt;

  const [updated] = await tx
    .update(serviceRequests)
    .set({
      status: plan.nextStatus,
      updatedAt: now,
      assignedNurseUserId: nurseUserId,
      assignedAt: nextAssignedAt,
    })
    .where(eq(serviceRequests.id, requestId))
    .returning();

  if (!updated) {
    throw new RequestNotFoundError();
  }

  if (plan.shouldReleasePreviousNurse && previousNurseUserId) {
    await tx
      .update(nurses)
      .set({ isAvailable: true, updatedAt: now })
      .where(eq(nurses.userId, previousNurseUserId));
  }

  if (plan.shouldAssignNewNurse && nurseUserId) {
    await tx
      .update(nurses)
      .set({ isAvailable: false, updatedAt: now })
      .where(eq(nurses.userId, nurseUserId));
  }

  await appendRequestEvent(tx, {
    requestId,
    type: "request_reassigned",
    actorUserId,
    fromStatus: previousStatus,
    toStatus: plan.nextStatus as RequestStatus,
    meta: {
      previousNurseUserId,
      newNurseUserId: nurseUserId,
    },
  });

  return {
    request: updated,
    previousNurseUserId,
    previousStatus,
    nextStatus: plan.nextStatus as RequestStatus,
  };
}
