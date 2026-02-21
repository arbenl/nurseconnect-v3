import { db, schema } from "@nurseconnect/database";

const { adminAuditLogs } = schema;
const MAX_ADMIN_AUDIT_DETAILS_LENGTH = 10_000;

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type AdminAuditAction =
  | "user.role.changed"
  | "request.reassigned"
  | "nurse.availability.overridden";

type RecordAdminActionInput = {
  actorUserId: string;
  action: AdminAuditAction;
  targetEntityType: "user" | "request";
  targetEntityId: string;
  details?: Record<string, unknown> | null;
};

function validateAdminActionDetails(details?: Record<string, unknown> | null) {
  if (!details) {
    return null;
  }
  try {
    const serialized = JSON.stringify(details);
    if (serialized.length > MAX_ADMIN_AUDIT_DETAILS_LENGTH) {
      throw new Error(
        `Admin audit details too large (max ${MAX_ADMIN_AUDIT_DETAILS_LENGTH} characters)`
      );
    }
    return details;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Invalid admin audit details payload",
    );
  }
}

type RecordAdminActionWriter = {
  insert: typeof db.insert;
};

export async function recordAdminAction(
  input: RecordAdminActionInput,
  tx: Transaction | RecordAdminActionWriter = db,
) {
  const { actorUserId, action, targetEntityType, targetEntityId, details } = input;
  const safeDetails = validateAdminActionDetails(details);

  await tx.insert(adminAuditLogs).values({
    actorUserId,
    action,
    targetEntityType,
    targetEntityId,
    details: safeDetails,
  });
}
