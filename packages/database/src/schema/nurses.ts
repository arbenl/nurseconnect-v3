import { pgTable, uuid, text, timestamp, uniqueIndex, boolean, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users";

export const nurseStatusEnum = pgEnum("nurse_status", [
  "draft",
  "submitted",
  "under_review",
  "verified",
  "rejected",
  "suspended",
  "expired",
  "renewal_pending",
]);

export const nurses = pgTable(
  "nurses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: nurseStatusEnum("status").notNull().default("draft"),
    phone: text("phone"),
    bio: text("bio"),

    // Onboarding and credential fields
    licenseNumber: text("license_number"),
    licenseJurisdiction: text("license_jurisdiction"),
    specialization: text("specialization"),
    licenseValidUntil: timestamp("license_valid_until", { withTimezone: true }),
    
    // Verification audit
    verifiedBy: uuid("verified_by").references(() => users.id, { onDelete: "set null" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    
    // Suspension audit
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    suspensionReason: text("suspension_reason"),

    isAvailable: boolean("is_available").default(false).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userUq: uniqueIndex("nurses_user_id_uq").on(t.userId),
  })
);
