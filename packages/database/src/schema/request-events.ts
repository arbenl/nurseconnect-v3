import { index, jsonb, pgEnum, pgTable, serial, timestamp, uuid } from "drizzle-orm/pg-core";

import { serviceRequestStatusEnum, serviceRequests } from "./service-requests";
import { users } from "./users";

export const requestEventTypeEnum = pgEnum("service_request_event_type", [
    "request_created",
    "request_assigned",
    "request_accepted",
    "request_rejected",
    "request_enroute",
    "request_completed",
    "request_canceled",
    "request_reassigned",
]);

export const requestEvents = pgTable(
    "service_request_events",
    {
        id: serial("id").primaryKey(),
        requestId: uuid("request_id")
            .notNull()
            .references(() => serviceRequests.id, { onDelete: "cascade" }),
        type: requestEventTypeEnum("type").notNull(),
        actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
        fromStatus: serviceRequestStatusEnum("from_status"),
        toStatus: serviceRequestStatusEnum("to_status"),
        meta: jsonb("meta"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => ({
        requestIdIdx: index("service_request_events_request_id_id_idx").on(t.requestId, t.id),
    })
);
