import { pgTable, uuid, text, timestamp, numeric, index } from "drizzle-orm/pg-core";
import { users } from "./users";

export const serviceRequests = pgTable(
    "service_requests",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        patientUserId: uuid("patient_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        assignedNurseUserId: uuid("assigned_nurse_user_id").references(() => users.id, { onDelete: "set null" }),

        status: text("status").notNull().default("open"), // open, assigned, enroute, completed, canceled

        address: text("address").notNull(),
        lat: numeric("lat", { precision: 9, scale: 6 }).notNull(),
        lng: numeric("lng", { precision: 9, scale: 6 }).notNull(),

        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => ({
        patientIdx: index("service_requests_patient_idx").on(t.patientUserId),
        nurseIdx: index("service_requests_nurse_idx").on(t.assignedNurseUserId),
        statusIdx: index("service_requests_status_idx").on(t.status),
    })
);
