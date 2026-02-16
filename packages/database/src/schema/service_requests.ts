import { pgTable, uuid, text, timestamp, doublePrecision, index } from "drizzle-orm/pg-core";
import { patients } from "./patients";

export const serviceRequests = pgTable(
  "service_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    patientId: uuid("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
    status: text("status").notNull(), // later enum: open|assigned|completed|cancelled
    serviceType: text("service_type").notNull(),
    notes: text("notes"),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    patientIdx: index("service_requests_patient_id_idx").on(t.patientId),
    statusIdx: index("service_requests_status_idx").on(t.status),
  })
);
