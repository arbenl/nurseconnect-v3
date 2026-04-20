import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { serviceRequests } from "./service-requests";
import { users } from "./users";

export const nursePayoutStatusEnum = pgEnum("nurse_payout_status", [
  "owed",
  "paid",
  "failed",
  "canceled",
]);

export const nursePayouts = pgTable(
  "nurse_payouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "cascade" }),
    nurseUserId: uuid("nurse_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: nursePayoutStatusEnum("status").notNull().default("owed"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    provider: text("provider"),
    providerReference: text("provider_reference"),
    note: text("note"),
    failureReason: text("failure_reason"),
    owedAt: timestamp("owed_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    requestUniqueIdx: uniqueIndex("nurse_payouts_request_id_uidx").on(table.requestId),
    nurseIdx: index("nurse_payouts_nurse_user_id_idx").on(table.nurseUserId),
    statusIdx: index("nurse_payouts_status_idx").on(table.status),
    createdAtIdx: index("nurse_payouts_created_at_idx").on(table.createdAt),
  }),
);
