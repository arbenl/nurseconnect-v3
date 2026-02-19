import type { RequestStatus } from "@nurseconnect/contracts";
import { db, eq, schema, sql } from "@nurseconnect/database";

import { canTransition, type RequestAction } from "./request-lifecycle";

const { nurses, serviceRequests } = schema;

type LockedRequestRow = {
  id: string;
  status: RequestStatus;
  patient_user_id: string;
  assigned_nurse_user_id: string | null;
  assigned_at: Date | null;
};

export class RequestNotFoundError extends Error {
  constructor(message = "Request not found") {
    super(message);
    this.name = "RequestNotFoundError";
  }
}

export class RequestForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "RequestForbiddenError";
  }
}

export class RequestConflictError extends Error {
  constructor(message = "Conflict") {
    super(message);
    this.name = "RequestConflictError";
  }
}

type ApplyRequestActionInput = {
  requestId: string;
  actorUserId: string;
  action: RequestAction;
  reason?: string;
};

const nurseActions = new Set<RequestAction>(["accept", "reject", "enroute", "complete"]);

export async function applyRequestAction(input: ApplyRequestActionInput) {
  const { requestId, actorUserId, action } = input;
  // Extension point: reason can be persisted in a future service_request_events table.
  void input.reason;

  return db.transaction(async (tx) => {
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
        throw new RequestForbiddenError("Only the assigned nurse can perform this action");
      }

      const [nurseProfile] = await tx
        .select()
        .from(nurses)
        .where(eq(nurses.userId, actorUserId));

      if (!nurseProfile) {
        throw new RequestForbiddenError("Nurse profile is required");
      }

      if (action === "accept" && !nurseProfile.isAvailable) {
        throw new RequestConflictError("Nurse is not available to accept");
      }
    }

    const nextStatus = canTransition(locked.status, action);

    if (locked.status === nextStatus) {
      throw new RequestConflictError(`Request is already in status '${nextStatus}'`);
    }

    const now = new Date();

    const updateData: Partial<typeof serviceRequests.$inferInsert> = {
      status: nextStatus,
      updatedAt: now,
    };

    switch (action) {
      case "accept":
        updateData.acceptedAt = now;
        if (!locked.assigned_at) {
          updateData.assignedAt = now;
        }
        break;
      case "reject":
        updateData.status = "open";
        updateData.assignedNurseUserId = null;
        updateData.rejectedAt = now;
        break;
      case "enroute":
        updateData.enrouteAt = now;
        break;
      case "complete":
        updateData.completedAt = now;
        break;
      case "cancel":
        updateData.canceledAt = now;
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

    if (action === "accept") {
      await tx
        .update(nurses)
        .set({ isAvailable: false, updatedAt: now })
        .where(eq(nurses.userId, actorUserId));
    }

    if (action === "reject" || action === "complete") {
      await tx
        .update(nurses)
        .set({ isAvailable: true, updatedAt: now })
        .where(eq(nurses.userId, actorUserId));
    }

    if (action === "cancel" && locked.assigned_nurse_user_id) {
      await tx
        .update(nurses)
        .set({ isAvailable: true, updatedAt: now })
        .where(eq(nurses.userId, locked.assigned_nurse_user_id));
    }

    return updated;
  });
}
