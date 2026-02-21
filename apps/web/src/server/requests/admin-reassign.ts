import type { RequestStatus } from "@nurseconnect/contracts";
import { db, eq, schema, sql } from "@nurseconnect/database";

import { recordAdminAction } from "@/server/admin/audit";

import { appendRequestEvent } from "./request-events";

const { nurses, users, serviceRequests } = schema;

type LockedRequestRow = {
  id: string;
  status: string;
  assignedNurseUserId: string | null;
  assignedAt: Date | null;
};

export class RequestReassignForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "RequestReassignForbiddenError";
  }
}

export class RequestReassignValidationError extends Error {
  constructor(message = "Invalid request reassignment") {
    super(message);
    this.name = "RequestReassignValidationError";
  }
}

export class RequestNotFoundError extends Error {
  constructor(message = "Request not found") {
    super(message);
    this.name = "RequestNotFoundError";
  }
}

type ReassignResult = {
  request: typeof serviceRequests.$inferSelect;
  previousNurseUserId: string | null;
};

export async function reassignRequest(input: {
  requestId: string;
  actorUserId: string;
  nurseUserId: string | null;
}): Promise<ReassignResult> {
  const { requestId, actorUserId, nurseUserId } = input;

  return db.transaction(async (tx) => {
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
        "Only open or assigned requests can be reassigned"
      );
    }

    if (nurseUserId !== null) {
      const userRows = await tx.select().from(users).where(eq(users.id, nurseUserId));
      const nurseProfile = userRows[0];
      if (!nurseProfile) {
        throw new RequestReassignValidationError("Target nurse user not found");
      }
      if (nurseProfile.role !== "nurse") {
        throw new RequestReassignValidationError("Target user is not a nurse");
      }

      const nurseRows = await tx
        .select()
        .from(nurses)
        .where(eq(nurses.userId, nurseUserId));
      if (!nurseRows[0]) {
        throw new RequestReassignValidationError("Nurse profile not found");
      }
    }

    const previousNurseUserId = request.assignedNurseUserId;
    const previousAssignedAt = request.assignedAt;
    const previousStatus = request.status as RequestStatus;
    const nextStatus: RequestStatus = nurseUserId ? "assigned" : "open";
    const isPreviouslyAssigned = request.status === "assigned";
    const shouldReleasePreviousNurse = isPreviouslyAssigned && previousNurseUserId && nextStatus === "open";
    const shouldAssignNewNurse =
      nurseUserId !== null && (!isPreviouslyAssigned || nurseUserId !== previousNurseUserId);
    const now = new Date();
    const nextAssignedAt = nurseUserId ? now : previousAssignedAt;

    const updatePayload = {
      status: nextStatus,
      updatedAt: now,
      assignedNurseUserId: nurseUserId,
      assignedAt: nextAssignedAt,
    };

    const [updated] = await tx
      .update(serviceRequests)
      .set(updatePayload)
      .where(eq(serviceRequests.id, requestId))
      .returning();
    if (!updated) {
      throw new RequestNotFoundError();
    }

    if (shouldReleasePreviousNurse) {
      if (previousNurseUserId) {
        await tx
          .update(nurses)
          .set({ isAvailable: true, updatedAt: now })
          .where(eq(nurses.userId, previousNurseUserId));
      }
    }

    if (shouldAssignNewNurse) {
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
      toStatus: nextStatus as RequestStatus,
      meta: {
        previousNurseUserId,
        newNurseUserId: nurseUserId,
      },
    });

    await recordAdminAction(
      {
        actorUserId,
        action: "request.reassigned",
        targetEntityType: "request",
        targetEntityId: requestId,
        details: {
          requestId,
          nurseUserId,
          previousNurseUserId,
          previousStatus,
          nextStatus,
        },
      },
      tx,
    );

    return {
      request: updated,
      previousNurseUserId,
    };
  });
}
