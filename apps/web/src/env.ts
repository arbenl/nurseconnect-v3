import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// ── Firebase rejection guard ────────────────────────────────────────
// V3 does not use Firebase. Fail hard if any Firebase env vars leak in.
const REJECTED_FIREBASE_VARS = [
  "NEXT_PUBLIC_USE_EMULATORS",
  "FIRESTORE_EMULATOR_HOST",
  "FIREBASE_AUTH_EMULATOR_HOST",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
] as const;

for (const key of REJECTED_FIREBASE_VARS) {
  if (process.env[key]) {
    throw new Error(
      `[env] Firebase is not supported in V3. Remove "${key}" from your environment.`
    );
  }
}

// ── Validated environment ───────────────────────────────────────────
export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),
    DATABASE_URL: z
      .string()
      .url()
      .refine(
        (url) => url.startsWith("postgres://") || url.startsWith("postgresql://"),
        "DATABASE_URL must use postgres:// or postgresql:// scheme"
      ),
    DATABASE_POOL_URL: z
      .string()
      .url()
      .refine(
        (url) => url.startsWith("postgres://") || url.startsWith("postgresql://"),
        "DATABASE_POOL_URL must use postgres:// or postgresql:// scheme"
      )
      .optional(),
    PGPOOL_MAX: z.coerce.number().int().positive().optional(),
    PGPOOL_MIN: z.coerce.number().int().nonnegative().optional(),
    PGPOOL_IDLE_TIMEOUT_MS: z.coerce.number().int().nonnegative().optional(),
    PGPOOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().nonnegative().optional(),
    PGPOOL_MAX_LIFETIME_SECONDS: z.coerce.number().int().nonnegative().optional(),
    PGPOOL_ALLOW_EXIT_ON_IDLE: z.coerce.boolean().optional(),
    BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
    FIRST_ADMIN_EMAILS: z.string().optional(),

    // Feature flags — postgres-only during V3 mandate
    FEATURE_BACKEND_NURSE_PROFILE: z.literal("postgres").default("postgres"),
    FEATURE_BACKEND_PATIENT_PROFILE: z.literal("postgres").default("postgres"),
    FEATURE_BACKEND_SERVICE_REQUEST: z.literal("postgres").default("postgres"),
    FEATURE_BACKEND_ASSIGNMENT: z.literal("postgres").default("postgres"),
    FEATURE_BACKEND_VISIT: z.literal("postgres").default("postgres"),
  },
  client: {
    // V3 has no client-side env vars yet. Add as needed.
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_POOL_URL: process.env.DATABASE_POOL_URL,
    PGPOOL_MAX: process.env.PGPOOL_MAX,
    PGPOOL_MIN: process.env.PGPOOL_MIN,
    PGPOOL_IDLE_TIMEOUT_MS: process.env.PGPOOL_IDLE_TIMEOUT_MS,
    PGPOOL_CONNECTION_TIMEOUT_MS: process.env.PGPOOL_CONNECTION_TIMEOUT_MS,
    PGPOOL_MAX_LIFETIME_SECONDS: process.env.PGPOOL_MAX_LIFETIME_SECONDS,
    PGPOOL_ALLOW_EXIT_ON_IDLE: process.env.PGPOOL_ALLOW_EXIT_ON_IDLE,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    FIRST_ADMIN_EMAILS: process.env.FIRST_ADMIN_EMAILS,
    FEATURE_BACKEND_NURSE_PROFILE: process.env.FEATURE_BACKEND_NURSE_PROFILE,
    FEATURE_BACKEND_PATIENT_PROFILE: process.env.FEATURE_BACKEND_PATIENT_PROFILE,
    FEATURE_BACKEND_SERVICE_REQUEST: process.env.FEATURE_BACKEND_SERVICE_REQUEST,
    FEATURE_BACKEND_ASSIGNMENT: process.env.FEATURE_BACKEND_ASSIGNMENT,
    FEATURE_BACKEND_VISIT: process.env.FEATURE_BACKEND_VISIT,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
