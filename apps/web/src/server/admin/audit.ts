import { db, schema } from "@nurseconnect/database";

const { adminAuditLogs } = schema;

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

export async function recordAdminAction(input: RecordAdminActionInput) {
  const { actorUserId, action, targetEntityType, targetEntityId, details } = input;
  await db.insert(adminAuditLogs).values({
    actorUserId,
    action,
    targetEntityType,
    targetEntityId,
    details,
  });
}
