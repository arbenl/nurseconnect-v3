import { pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./users";

export const referralPartnerStatusEnum = pgEnum("referral_partner_status", ["active", "inactive"]);

export const referralPartners = pgTable(
  "referral_partners",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationName: text("organization_name").notNull(),
    status: referralPartnerStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userUq: uniqueIndex("referral_partners_user_id_uq").on(t.userId),
  }),
);
