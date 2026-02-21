import { pgTable, uuid, text, jsonb, timestamp, serial } from "drizzle-orm/pg-core";
import { users } from "./users";

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: serial("id").primaryKey(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  targetEntityType: text("target_entity_type").notNull(),
  targetEntityId: uuid("target_entity_id").notNull(),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

