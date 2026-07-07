import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { serviceRequests } from "./service-requests";
import { nurses } from "./nurses";
import { organizations } from "./organizations";

export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id").notNull().references(() => serviceRequests.id, { onDelete: "cascade" }),
    nurseId: uuid("nurse_id").notNull().references(() => nurses.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "restrict" }),
    status: text("status").notNull(), // later enum: assigned|accepted|arrived|completed|cancelled
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    requestIdx: index("assignments_request_id_idx").on(t.requestId),
    nurseIdx: index("assignments_nurse_id_idx").on(t.nurseId),
    organizationIdx: index("assignments_organization_id_idx").on(t.organizationId),
  })
);
