import { index, numeric, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";
import { serviceAreas } from "./service-areas";

export const nurseLocations = pgTable(
    "nurse_locations",
    {
        nurseUserId: uuid("nurse_user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
        lat: numeric("lat", { precision: 9, scale: 6 }).notNull(),
        lng: numeric("lng", { precision: 9, scale: 6 }).notNull(),
        serviceAreaId: uuid("service_area_id").references(() => serviceAreas.id, { onDelete: "set null" }),
        lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => ({
        serviceAreaIdx: index("nurse_locations_service_area_id_idx").on(table.serviceAreaId),
    }),
);
