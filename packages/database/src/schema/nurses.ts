import { pgTable, uuid, text, timestamp, uniqueIndex, boolean } from "drizzle-orm/pg-core";
import { users } from "./users";

export const nurses = pgTable(
  "nurses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull(), // later enum: pending|verified|suspended
    phone: text("phone"),
    bio: text("bio"),

    // PR-3.4: Onboarding fields
    licenseNumber: text("license_number"), // Nullable to allow partial profile or step-wise creation
    specialization: text("specialization"),
    isAvailable: boolean("is_available").default(false).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userUq: uniqueIndex("nurses_user_id_uq").on(t.userId),
  })
);
