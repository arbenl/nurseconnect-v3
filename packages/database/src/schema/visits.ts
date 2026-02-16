import { pgTable, uuid, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { assignments } from "./assignments";

export const visits = pgTable(
  "visits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assignmentId: uuid("assignment_id").notNull().references(() => assignments.id, { onDelete: "cascade" }),
    summary: text("summary"),
    rating: integer("rating"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    assignmentIdx: index("visits_assignment_id_idx").on(t.assignmentId),
  })
);
