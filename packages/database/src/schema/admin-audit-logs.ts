import { index, jsonb, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: serial("id").primaryKey(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  targetEntityType: text("target_entity_type").notNull(),
  targetEntityId: uuid("target_entity_id").notNull(),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  actorUserIdIdx: index("admin_audit_logs_actor_user_id_idx").on(table.actorUserId),
  actionIdx: index("admin_audit_logs_action_idx").on(table.action),
  targetEntityIdx: index("admin_audit_logs_target_entity_idx").on(table.targetEntityType, table.targetEntityId),
  createdAtIdx: index("admin_audit_logs_created_at_idx").on(table.createdAt),
  actorUserCreatedAtIdx: index("admin_audit_logs_created_at_actor_user_id_idx").on(
    table.createdAt,
    table.actorUserId,
  ),
}));
