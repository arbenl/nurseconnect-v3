import { db, schema } from "@nurseconnect/database";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";

import { sendBetterAuthVerificationEmail } from "./auth/email-provider";
import {
  EMAIL_VERIFICATION_TOKEN_TTL_SECONDS,
  resolveEmailVerificationConfig,
} from "./auth/email-verification-config";

const {
  authUsers,
  authSessions,
  authAccounts,
  authVerifications,
} = schema;

const emailVerificationConfig = resolveEmailVerificationConfig();
const BASE_PATH = "/api/auth";

export const auth = betterAuth({
  // Always set baseURL explicitly for stability/security in prod.
  baseURL: emailVerificationConfig.appUrl,
  basePath: BASE_PATH,

  // Lock trusted origins (CSRF/origin checks).
  trustedOrigins: emailVerificationConfig.trustedOrigins,

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
  emailAndPassword: {
    enabled: true,
    // Observe mode keeps rollout non-blocking while requireAuth records unverified access.
    autoSignIn: emailVerificationConfig.mode !== "enforce",
    requireEmailVerification: emailVerificationConfig.mode === "enforce",
  },

  emailVerification: {
    sendVerificationEmail: sendBetterAuthVerificationEmail,
    sendOnSignUp: emailVerificationConfig.mode !== "off",
    sendOnSignIn: emailVerificationConfig.mode !== "off",
    expiresIn: EMAIL_VERIFICATION_TOKEN_TTL_SECONDS,
  },

  // Optional: enable joins if you have relations defined and want perf gains.
  // experimental: { joins: true },
});
