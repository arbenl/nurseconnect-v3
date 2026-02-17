import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Auth tables for Better-Auth (baseline).
 * Keep these separate from your domain "users" table until cutover is complete.
 * Once Better-Auth is the source of truth, you can:
 *  - either merge with your domain users table
 *  - or map domain users -> auth users via user_id
 */

export const authUsers = pgTable(
  "auth_users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name"),
    image: text("image"),
    emailVerified: boolean("email_verified").notNull().default(false),

    // optional fields used by some auth flows
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    emailUq: uniqueIndex("auth_users_email_uq").on(t.email),
    emailIdx: index("auth_users_email_idx").on(t.email),
  })
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),

    // session token or id (implementation-specific)
    token: text("token").notNull(),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tokenUq: uniqueIndex("auth_sessions_token_uq").on(t.token),
    userIdx: index("auth_sessions_user_id_idx").on(t.userId),
    expiresIdx: index("auth_sessions_expires_idx").on(t.expiresAt),
  })
);

export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),

    // provider info (google, github, credentials, etc.)
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),

    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    idToken: text("id_token"),
    scope: text("scope"),
    tokenType: text("token_type"),
    password: text("password"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    providerUq: uniqueIndex("auth_accounts_provider_uq").on(
      t.providerId,
      t.accountId
    ),
    userIdx: index("auth_accounts_user_id_idx").on(t.userId),
  })
);

export const authVerifications = pgTable(
  "auth_verifications",
  {
    id: text("id").primaryKey(),

    // for email verification, password reset, magic links, etc.
    identifier: text("identifier").notNull(), // email or user id
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (t) => ({
    tokenUq: uniqueIndex("auth_verifications_token_uq").on(t.value),
    identifierIdx: index("auth_verifications_identifier_idx").on(t.identifier),
    expiresIdx: index("auth_verifications_expires_idx").on(t.expiresAt),
  })
);
