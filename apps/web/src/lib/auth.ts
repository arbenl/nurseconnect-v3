import { db, schema } from "@nurseconnect/database";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";

const {
  authUsers,
  authSessions,
  authAccounts,
  authVerifications,
} = schema;

// NOTE: This file runs on the server (route handler imports it).
const VERCEL_DEPLOYMENT_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : undefined;
const APP_URL =
  process.env.APP_URL ??
  process.env.BETTER_AUTH_URL ??
  VERCEL_DEPLOYMENT_URL ??
  "http://localhost:3010";
const TRUSTED_ORIGINS = Array.from(
  new Set(
    [APP_URL, process.env.BETTER_AUTH_URL, VERCEL_DEPLOYMENT_URL].filter(
      (origin): origin is string => Boolean(origin),
    ),
  ),
);
const BASE_PATH = "/api/auth";

export const auth = betterAuth({
  // Always set baseURL explicitly for stability/security in prod.
  baseURL: APP_URL,
  basePath: BASE_PATH,

  // Lock trusted origins (CSRF/origin checks).
  trustedOrigins: TRUSTED_ORIGINS,

  // Database (Drizzle + Postgres).
  database: drizzleAdapter(db, {
    provider: "pg",
    // Map your Drizzle tables to Better Auth model names if you renamed them.
    schema: {
      user: authUsers,
      session: authSessions,
      account: authAccounts,
      verification: authVerifications,
    },
  }),

  // Minimum needed auth mode for now (email+password).
  // You can tighten later (requireEmailVerification, reset email sender, etc.).
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: false,
  },

  // Optional: enable joins if you have relations defined and want perf gains.
  // experimental: { joins: true },
});
