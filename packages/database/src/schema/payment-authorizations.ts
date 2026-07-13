import {
  foreignKey,
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
import { organizations } from "./organizations";
import { users } from "./users";

export const paymentAuthorizationStatusEnum = pgEnum("payment_authorization_status", [
  "authorized",
  "captured",
  "voided",
  "failed",
]);

export const paymentAuthorizations = pgTable(
  "payment_authorizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "restrict" }),
    patientUserId: uuid("patient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: paymentAuthorizationStatusEnum("status").notNull().default("authorized"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    provider: text("provider"),
    providerReference: text("provider_reference"),
    note: text("note"),
    failureReason: text("failure_reason"),
    authorizedAt: timestamp("authorized_at", { withTimezone: true }).notNull().defaultNow(),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    requestUniqueIdx: uniqueIndex("payment_authorizations_request_id_uidx").on(table.requestId),
    organizationIdx: index("payment_authorizations_organization_id_idx").on(table.organizationId),
    patientIdx: index("payment_authorizations_patient_user_id_idx").on(table.patientUserId),
    statusIdx: index("payment_authorizations_status_idx").on(table.status),
    createdAtIdx: index("payment_authorizations_created_at_idx").on(table.createdAt),
    requestOwnerFk: foreignKey({
      columns: [table.requestId, table.organizationId, table.patientUserId],
      foreignColumns: [
        serviceRequests.id,
        serviceRequests.organizationId,
        serviceRequests.patientUserId,
      ],
      name: "payment_authorizations_request_owner_fk",
    }).onDelete("cascade"),
  }),
);
