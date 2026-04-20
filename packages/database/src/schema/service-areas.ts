import { index, integer, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const serviceAreaStatusEnum = pgEnum("service_area_status", [
  "active",
  "paused",
]);

export const serviceAreas = pgTable(
  "service_areas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    label: text("label").notNull(),
    centerLat: numeric("center_lat", { precision: 9, scale: 6 }).notNull(),
    centerLng: numeric("center_lng", { precision: 9, scale: 6 }).notNull(),
    radiusMeters: integer("radius_meters").notNull(),
    status: serviceAreaStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index("service_areas_status_idx").on(table.status),
  }),
);
