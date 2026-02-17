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
    authId: text("auth_id"), // Link to better-auth user.id

    // Profile fields (Phase 3.3)
    firstName: text("first_name"),
    lastName: text("last_name"),
    phone: text("phone"),
    city: text("city"),
    address: text("address"),
    profileCompletedAt: timestamp("profile_completed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: index("users_email_idx").on(t.email),
    firebaseUidIdx: uniqueIndex("users_firebase_uid_idx").on(t.firebaseUid),
    authIdIdx: uniqueIndex("users_auth_id_idx").on(t.authId),
    roleCheck: check("users_role_check", sql`${t.role} IN ('admin', 'nurse', 'patient')`),
  })
);
