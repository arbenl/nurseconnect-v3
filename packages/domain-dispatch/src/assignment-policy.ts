import type { DbClient } from "@nurseconnect/database";
import { nurses, serviceRequests, users } from "@nurseconnect/database/schema";
import {
  appendRequestEvent,
  canTransition,
  requestStatusUpdate,
  transitionStatus,
} from "@nurseconnect/domain-request";
import { and, eq } from "drizzle-orm";

import { DispatchValidationError } from "./errors";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type UserRole = typeof users.$inferSelect.role;

type EligibilityInput = {
  userExists: boolean;
  role: UserRole | null;
  nurseExists: boolean;
  nurseStatus: string | null;
  licenseValidUntil: Date | string | null;
};

export function assertDispatchEligibleNurse(input: EligibilityInput) {
  if (!input.userExists) {
    throw new DispatchValidationError("Target nurse user not found");
  }

  if (input.role !== "nurse") {
    throw new DispatchValidationError("Target user is not a nurse");
  }

  if (!input.nurseExists) {
    throw new DispatchValidationError("Nurse profile not found");
  }

  if (input.nurseStatus !== "verified") {
    throw new DispatchValidationError("Target nurse is not verified");
  }

  if (
    input.licenseValidUntil &&
    new Date(input.licenseValidUntil) <= new Date()
  ) {
    throw new DispatchValidationError("Target nurse license has expired");
  }
}

export async function validateDispatchEligibleNurse(
  tx: Transaction,
  nurseUserId: string,
) {
  const [targetUser] = await tx.select().from(users).where(eq(users.id, nurseUserId));
  const [nurseRecord] = await tx
    .select()
    .from(nurses)
    .where(eq(nurses.userId, nurseUserId));

  assertDispatchEligibleNurse({
    userExists: Boolean(targetUser),
    role: targetUser?.role ?? null,
    nurseExists: Boolean(nurseRecord),
    nurseStatus: nurseRecord?.status ?? null,
    licenseValidUntil: nurseRecord?.licenseValidUntil ?? null,
  });
}

export async function assignRequestToNurse(
  tx: Transaction,
  input: {
    request: typeof serviceRequests.$inferSelect;
    nurseUserId: string;
    skipEligibilityValidation: boolean;
  },
) {
  const { request, nurseUserId, skipEligibilityValidation } = input;

  if (!skipEligibilityValidation) {
    await validateDispatchEligibleNurse(tx, nurseUserId);
  }

  const assignedAt = new Date();
  const transition = canTransition(request.status, "assign", {
    requestId: request.id,
    actorUserId: null,
  });
  const nextStatus = transitionStatus(transition);

  const [updated] = await tx
    .update(serviceRequests)
    .set(requestStatusUpdate(transition, {
      requestId: request.id,
      actorUserId: null,
      fromStatus: request.status,
      toStatus: nextStatus,
    }, {
      assignedNurseUserId: nurseUserId,
      assignedAt,
      updatedAt: assignedAt,
    }))
    .where(and(
      eq(serviceRequests.id, request.id),
      eq(serviceRequests.status, request.status),
    ))
    .returning();

  if (!updated) {
    throw new DispatchValidationError("Request status changed during assignment");
  }

  await tx
    .update(nurses)
    .set({
      isAvailable: false,
      updatedAt: assignedAt,
    })
    .where(eq(nurses.userId, nurseUserId));

  await appendRequestEvent(tx, {
    requestId: updated.id,
    type: "request_assigned",
    actorUserId: null,
    fromStatus: request.status,
    toStatus: nextStatus,
    meta: {
      nurseUserId,
    },
  });

  return updated;
}
