import { count, db, desc, eq, or, schema } from "@nurseconnect/database";

import { recordAdminAction } from "@/server/admin/audit";

const { nurses, users } = schema;

const NURSE_CREDENTIAL_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "verified",
  "rejected",
  "suspended",
  "expired",
  "renewal_pending",
] as const;

const EMPTY_NURSE_CREDENTIAL_COUNTS = {
  total: 0,
  available: 0,
  needsAttention: 0,
  draft: 0,
  submitted: 0,
  under_review: 0,
  verified: 0,
  rejected: 0,
  suspended: 0,
  expired: 0,
  renewal_pending: 0,
} as const;

const ATTENTION_STATUSES: NurseCredentialStatus[] = [
  "submitted",
  "under_review",
  "renewal_pending",
  "suspended",
];

type NurseCredentialCounts = {
  total: number;
  available: number;
  needsAttention: number;
} & Record<NurseCredentialStatus, number>;

export type NurseCredentialStatus = (typeof NURSE_CREDENTIAL_STATUSES)[number];

export class NurseCredentialValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NurseCredentialValidationError";
  }
}

function assertValidStatuses(statuses: string[]): NurseCredentialStatus[] {
  return statuses.filter((status): status is NurseCredentialStatus =>
    NURSE_CREDENTIAL_STATUSES.includes(status as NurseCredentialStatus),
  );
}

export async function listNurseCredentials(options?: {
  statuses?: string[];
  limit?: number;
}) {
  const validStatuses = options?.statuses ? assertValidStatuses(options.statuses) : [];
  if (options?.statuses && validStatuses.length === 0) {
    return [];
  }
  const whereClause =
    validStatuses.length
      ? or(...validStatuses.map((status) => eq(nurses.status, status)))
      : undefined;

  const baseQuery = db
    .select({
      id: nurses.id,
      userId: nurses.userId,
      status: nurses.status,
      licenseNumber: nurses.licenseNumber,
      licenseJurisdiction: nurses.licenseJurisdiction,
      specialization: nurses.specialization,
      licenseValidUntil: nurses.licenseValidUntil,
      verifiedBy: nurses.verifiedBy,
      verifiedAt: nurses.verifiedAt,
      suspendedAt: nurses.suspendedAt,
      suspensionReason: nurses.suspensionReason,
      isAvailable: nurses.isAvailable,
      createdAt: nurses.createdAt,
      updatedAt: nurses.updatedAt,
      userName: users.name,
      userEmail: users.email,
      userRole: users.role,
    })
    .from(nurses)
    .innerJoin(users, eq(nurses.userId, users.id))
    .where(whereClause)
    .orderBy(desc(nurses.updatedAt));

  if (options?.limit) {
    return baseQuery.limit(options.limit);
  }

  return baseQuery;
}

export async function getNurseCredentialCounts() {
  const [statusRows, availableRows] = await Promise.all([
    db
      .select({
        status: nurses.status,
        value: count(),
      })
      .from(nurses)
      .groupBy(nurses.status),
    db
      .select({
        value: count(),
      })
      .from(nurses)
      .where(eq(nurses.isAvailable, true)),
  ]);

  const counts: NurseCredentialCounts = {
    ...EMPTY_NURSE_CREDENTIAL_COUNTS,
    available: Number(availableRows[0]?.value ?? 0),
  };

  for (const row of statusRows) {
    const value = Number(row.value ?? 0);
    counts.total += value;
    counts[row.status] = value;
    if (ATTENTION_STATUSES.includes(row.status)) {
      counts.needsAttention += value;
    }
  }

  return counts;
}

export async function getNurseCredentialById(nurseId: string) {
  const rows = await db
    .select({
      id: nurses.id,
      userId: nurses.userId,
      status: nurses.status,
      licenseNumber: nurses.licenseNumber,
      licenseJurisdiction: nurses.licenseJurisdiction,
      specialization: nurses.specialization,
      licenseValidUntil: nurses.licenseValidUntil,
      verifiedBy: nurses.verifiedBy,
      verifiedAt: nurses.verifiedAt,
      suspendedAt: nurses.suspendedAt,
      suspensionReason: nurses.suspensionReason,
      isAvailable: nurses.isAvailable,
      createdAt: nurses.createdAt,
      updatedAt: nurses.updatedAt,
      userName: users.name,
      userEmail: users.email,
      userRole: users.role,
    })
    .from(nurses)
    .innerJoin(users, eq(nurses.userId, users.id))
    .where(eq(nurses.id, nurseId));

  return rows[0] ?? null;
}

export async function verifyNurseCredential(input: {
  actorUserId: string;
  nurseId: string;
  licenseValidUntil: string;
  licenseJurisdiction?: string;
}) {
  const nurse = await getNurseCredentialById(input.nurseId);
  if (!nurse) {
    return null;
  }

  const now = new Date();
  const validUntil = new Date(input.licenseValidUntil);
  if (Number.isNaN(validUntil.getTime())) {
    throw new NurseCredentialValidationError("licenseValidUntil must be a valid datetime");
  }
  if (validUntil <= now) {
    throw new NurseCredentialValidationError("licenseValidUntil must be in the future");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(nurses)
      .set({
        status: "verified",
        licenseValidUntil: validUntil,
        licenseJurisdiction: input.licenseJurisdiction ?? nurse.licenseJurisdiction,
        verifiedBy: input.actorUserId,
        verifiedAt: now,
        suspensionReason: null,
        suspendedAt: null,
        updatedAt: now,
      })
      .where(eq(nurses.id, input.nurseId));

    await tx
      .update(users)
      .set({ role: "nurse", updatedAt: now })
      .where(eq(users.id, nurse.userId));

    await recordAdminAction(
      {
        actorUserId: input.actorUserId,
        action: "nurse.credential.verified",
        targetEntityType: "nurse",
        targetEntityId: nurse.id,
        details: {
          userId: nurse.userId,
          previousStatus: nurse.status,
          nextStatus: "verified",
          licenseValidUntil: validUntil.toISOString(),
          licenseJurisdiction: input.licenseJurisdiction ?? nurse.licenseJurisdiction,
        },
      },
      tx,
    );
  });

  return getNurseCredentialById(input.nurseId);
}

export async function rejectNurseCredential(input: {
  actorUserId: string;
  nurseId: string;
  reason?: string;
}) {
  const nurse = await getNurseCredentialById(input.nurseId);
  if (!nurse) {
    return null;
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(nurses)
      .set({
        status: "rejected",
        isAvailable: false,
        updatedAt: now,
      })
      .where(eq(nurses.id, input.nurseId));

    await recordAdminAction(
      {
        actorUserId: input.actorUserId,
        action: "nurse.credential.rejected",
        targetEntityType: "nurse",
        targetEntityId: nurse.id,
        details: {
          userId: nurse.userId,
          previousStatus: nurse.status,
          nextStatus: "rejected",
          reason: input.reason ?? null,
        },
      },
      tx,
    );
  });

  return getNurseCredentialById(input.nurseId);
}

export async function suspendNurseCredential(input: {
  actorUserId: string;
  nurseId: string;
  reason: string;
}) {
  const nurse = await getNurseCredentialById(input.nurseId);
  if (!nurse) {
    return null;
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(nurses)
      .set({
        status: "suspended",
        isAvailable: false,
        suspendedAt: now,
        suspensionReason: input.reason,
        updatedAt: now,
      })
      .where(eq(nurses.id, input.nurseId));

    await recordAdminAction(
      {
        actorUserId: input.actorUserId,
        action: "nurse.credential.suspended",
        targetEntityType: "nurse",
        targetEntityId: nurse.id,
        details: {
          userId: nurse.userId,
          previousStatus: nurse.status,
          nextStatus: "suspended",
          reason: input.reason,
        },
      },
      tx,
    );
  });

  return getNurseCredentialById(input.nurseId);
}
