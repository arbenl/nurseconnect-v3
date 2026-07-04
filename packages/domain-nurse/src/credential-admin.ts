import { and, db, eq, schema } from "@nurseconnect/database";

import { recordAdminAction } from "@nurseconnect/platform-telemetry/admin-audit";

import {
  canRejectCredential,
  canSuspendCredential,
  canVerifyCredential,
  credentialStatusUpdate,
  type CredentialEvidenceContext,
} from "./credential-evidence";
import { NurseCredentialConflictError, NurseCredentialValidationError } from "./errors";
import { getNurseCredentialById, type NurseCredentialStatus } from "./credential-lifecycle";

const { nurses, users } = schema;

type AdminCredentialInput = CredentialEvidenceContext;

export async function verifyNurseCredential(input: AdminCredentialInput & {
  licenseValidUntil: string;
  licenseJurisdiction?: string;
}) {
  const nurse = await getNurseCredentialById(input.nurseId);
  if (!nurse) return null;

  const now = new Date();
  const validUntil = new Date(input.licenseValidUntil);
  if (Number.isNaN(validUntil.getTime())) {
    throw new NurseCredentialValidationError("licenseValidUntil must be a valid datetime");
  }
  if (validUntil <= now) throw new NurseCredentialValidationError("licenseValidUntil must be in the future");

  const evidence = canVerifyCredential(nurse.status, input);
  await db.transaction(async (tx) => {
    await persistCredentialStatus(input, nurse.status, "verify", evidence, {
      licenseValidUntil: validUntil,
      licenseJurisdiction: input.licenseJurisdiction ?? nurse.licenseJurisdiction,
      verifiedBy: input.actorUserId,
      verifiedAt: now,
      suspensionReason: null,
      suspendedAt: null,
      updatedAt: now,
    }, tx);
    await tx.update(users).set({ role: "nurse", updatedAt: now }).where(eq(users.id, nurse.userId));
    await recordAdminAction({
      actorUserId: input.actorUserId,
      action: "nurse.credential.verified",
      targetEntityType: "nurse",
      targetEntityId: nurse.id,
      details: { userId: nurse.userId, previousStatus: nurse.status, nextStatus: "verified", licenseValidUntil: validUntil.toISOString() },
    }, tx);
  });

  return getNurseCredentialById(input.nurseId);
}

export async function rejectNurseCredential(input: AdminCredentialInput & { reason?: string }) {
  const nurse = await getNurseCredentialById(input.nurseId);
  if (!nurse) return null;

  const now = new Date();
  const evidence = canRejectCredential(nurse.status, input);
  await db.transaction(async (tx) => {
    await persistCredentialStatus(input, nurse.status, "reject", evidence, {
      isAvailable: false,
      updatedAt: now,
    }, tx);
    await recordAdminAction({
      actorUserId: input.actorUserId,
      action: "nurse.credential.rejected",
      targetEntityType: "nurse",
      targetEntityId: nurse.id,
      details: { userId: nurse.userId, previousStatus: nurse.status, nextStatus: "rejected", reasonProvided: Boolean(input.reason) },
    }, tx);
  });

  return getNurseCredentialById(input.nurseId);
}

export async function suspendNurseCredential(input: AdminCredentialInput & { reason: string }) {
  const nurse = await getNurseCredentialById(input.nurseId);
  if (!nurse) return null;

  const now = new Date();
  const evidence = canSuspendCredential(nurse.status, input);
  await db.transaction(async (tx) => {
    await persistCredentialStatus(input, nurse.status, "suspend", evidence, {
      isAvailable: false,
      suspendedAt: now,
      suspensionReason: input.reason,
      updatedAt: now,
    }, tx);
    await recordAdminAction({
      actorUserId: input.actorUserId,
      action: "nurse.credential.suspended",
      targetEntityType: "nurse",
      targetEntityId: nurse.id,
      details: { userId: nurse.userId, previousStatus: nurse.status, nextStatus: "suspended", reasonProvided: true },
    }, tx);
  });

  return getNurseCredentialById(input.nurseId);
}

export async function persistCredentialStatus(
  input: AdminCredentialInput,
  fromStatus: NurseCredentialStatus,
  action: "verify" | "reject" | "suspend",
  evidence: Parameters<typeof credentialStatusUpdate>[0],
  extras: Parameters<typeof credentialStatusUpdate>[2],
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  const update = credentialStatusUpdate(evidence, { ...input, fromStatus, action }, extras);
  const rows = await tx
    .update(nurses)
    .set(update)
    .where(and(eq(nurses.id, input.nurseId), eq(nurses.status, fromStatus)))
    .returning({ id: nurses.id });
  if (rows.length === 0) throw new NurseCredentialConflictError();
}
