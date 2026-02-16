import { pgTable, uuid, text, timestamp, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    name: text("name"),
    role: text("role").notNull(), // Phase 2 will harden to enum
    firebaseUid: text("firebase_uid"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: index("users_email_idx").on(t.email),
    firebaseUidIdx: uniqueIndex("users_firebase_uid_idx").on(t.firebaseUid),
    roleCheck: check("users_role_check", sql`${t.role} IN ('admin', 'nurse', 'patient')`),
  })
);
