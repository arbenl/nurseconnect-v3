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

// ── NextAuth (legacy, Phase 2 removal) ──────────────────────────────
// NextAuth is still used in middleware, SessionProvider, dashboard pages,
// and tests. Do NOT reject NEXTAUTH_* vars until Phase 2 completes the
// Better-Auth migration. See docs/migration/data-sources.md.

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
    BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),

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
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    FEATURE_BACKEND_NURSE_PROFILE: process.env.FEATURE_BACKEND_NURSE_PROFILE,
    FEATURE_BACKEND_PATIENT_PROFILE: process.env.FEATURE_BACKEND_PATIENT_PROFILE,
    FEATURE_BACKEND_SERVICE_REQUEST: process.env.FEATURE_BACKEND_SERVICE_REQUEST,
    FEATURE_BACKEND_ASSIGNMENT: process.env.FEATURE_BACKEND_ASSIGNMENT,
    FEATURE_BACKEND_VISIT: process.env.FEATURE_BACKEND_VISIT,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
