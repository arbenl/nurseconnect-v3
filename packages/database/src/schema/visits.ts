import { pgTable, uuid, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { assignments } from "./assignments";
import { branches, organizations } from "./organizations";

export const visits = pgTable(
  "visits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assignmentId: uuid("assignment_id").notNull().references(() => assignments.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "restrict" }),
    summary: text("summary"),
    rating: integer("rating"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    assignmentIdx: index("visits_assignment_id_idx").on(t.assignmentId),
    organizationIdx: index("visits_organization_id_idx").on(t.organizationId),
    branchIdx: index("visits_branch_id_idx").on(t.branchId),
  })
);
