import { pgTable, uuid, numeric, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const nurseLocations = pgTable(
    "nurse_locations",
    {
        nurseUserId: uuid("nurse_user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
        lat: numeric("lat", { precision: 9, scale: 6 }).notNull(),
        lng: numeric("lng", { precision: 9, scale: 6 }).notNull(),
        lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),
    }
);
