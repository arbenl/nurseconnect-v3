import { pgTable, uuid, text, timestamp, numeric, index, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users";

export const serviceRequestStatusEnum = pgEnum("service_request_status", [
    "open",
    "assigned",
    "accepted",
    "enroute",
    "completed",
    "canceled",
    "rejected",
]);

export const serviceRequests = pgTable(
    "service_requests",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        patientUserId: uuid("patient_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        assignedNurseUserId: uuid("assigned_nurse_user_id").references(() => users.id, { onDelete: "set null" }),

        status: serviceRequestStatusEnum("status").notNull().default("open"),

        address: text("address").notNull(),
        lat: numeric("lat", { precision: 9, scale: 6 }).notNull(),
        lng: numeric("lng", { precision: 9, scale: 6 }).notNull(),
        assignedAt: timestamp("assigned_at", { withTimezone: true }),
        acceptedAt: timestamp("accepted_at", { withTimezone: true }),
        enrouteAt: timestamp("enroute_at", { withTimezone: true }),
        completedAt: timestamp("completed_at", { withTimezone: true }),
        canceledAt: timestamp("canceled_at", { withTimezone: true }),
        rejectedAt: timestamp("rejected_at", { withTimezone: true }),

        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => ({
        patientIdx: index("service_requests_patient_idx").on(t.patientUserId),
        nurseIdx: index("service_requests_nurse_idx").on(t.assignedNurseUserId),
        statusIdx: index("service_requests_status_idx").on(t.status),
    })
);
