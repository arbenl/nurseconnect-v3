#!/usr/bin/env node

/**
 * Environment validation check.
 * Run: pnpm env:check
 *
 * Validates the Next.js app's env.ts module:
 * 1. Rejects any Firebase env vars (hard error)
 * 2. Validates DATABASE_URL, BETTER_AUTH_SECRET, and feature flags
 *
 * Exit 0 = all vars present and valid
 * Exit 1 = missing or invalid vars (error printed to stderr)
 */

import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(__dirname, "../apps/web/src/env.ts");

try {
  // Use tsx to run the TypeScript env module
  // NODE_ENV defaults to 'development' when running standalone (Next.js sets it automatically)
  const childEnv = { ...process.env };
  if (!childEnv.NODE_ENV) childEnv.NODE_ENV = "development";
  execSync(`npx -y tsx -e "import('${envFile}')"`, {
    env: childEnv,
    stdio: ["pipe", "pipe", "pipe"],
    cwd: resolve(__dirname, ".."),
  });
  console.log("✅ Environment validation passed");
  process.exit(0);
} catch (err) {
  console.error("❌ Environment validation failed:");
  const stderr = err.stderr?.toString?.() || err.message || String(err);
  // Extract the meaningful error message
  const envError = stderr.match(/\[env\].*/)?.[0] || stderr;
  console.error(envError);
  process.exit(1);
}
