import { sql } from "drizzle-orm";
import { check, index, pgEnum, pgTable, timestamp, uniqueIndex, uuid, text } from "drizzle-orm/pg-core";

import { users } from "./users";

export const organizationStatusEnum = pgEnum("organization_status", ["active", "suspended", "archived"]);
export const branchStatusEnum = pgEnum("branch_status", ["active", "suspended", "archived"]);
export const orgMemberRoleEnum = pgEnum("org_member_role", [
  "owner",
  "admin",
  "coordinator",
  "requester",
  "viewer",
]);
export const orgMembershipStatusEnum = pgEnum("org_membership_status", ["active", "invited", "disabled"]);
export const orgMembershipSourceEnum = pgEnum("org_membership_source", ["bootstrap", "invitation", "api", "sso"]);

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: organizationStatusEnum("status").notNull().default("active"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex("organizations_slug_idx").on(t.slug),
    statusIdx: index("organizations_status_idx").on(t.status),
    slugFormatChk: check("organizations_slug_format_chk", sql`${t.slug} ~ '^[a-z0-9-]{2,63}$'`),
  }),
);

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: branchStatusEnum("status").notNull().default("active"),
    jurisdictionCountry: text("jurisdiction_country").notNull(),
    jurisdictionRegion: text("jurisdiction_region").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    organizationSlugIdx: uniqueIndex("branches_organization_slug_idx").on(t.organizationId, t.slug),
    organizationIdx: index("branches_organization_id_idx").on(t.organizationId),
    statusIdx: index("branches_status_idx").on(t.status),
    slugFormatChk: check("branches_slug_format_chk", sql`${t.slug} ~ '^[a-z0-9-]{2,63}$'`),
  }),
);

export const orgMemberships = pgTable(
  "org_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    role: orgMemberRoleEnum("role").notNull(),
    status: orgMembershipStatusEnum("status").notNull().default("active"),
    source: orgMembershipSourceEnum("source").notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    organizationUserIdx: uniqueIndex("org_memberships_organization_user_idx").on(t.organizationId, t.userId),
    userIdx: index("org_memberships_user_id_idx").on(t.userId),
    organizationIdx: index("org_memberships_organization_id_idx").on(t.organizationId),
    organizationStatusIdx: index("org_memberships_org_status_idx").on(t.organizationId, t.status),
  }),
).enableRLS();
