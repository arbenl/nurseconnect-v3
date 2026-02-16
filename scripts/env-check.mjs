#!/usr/bin/env node

/**
 * Environment validation check.
 * Run: pnpm env:check
 *
 * This script imports the env module which:
 * 1. Rejects any Firebase/NextAuth vars (hard error)
 * 2. Validates DATABASE_URL, BETTER_AUTH_SECRET, and feature flags
 *
 * Exit 0 = all vars present and valid
 * Exit 1 = missing or invalid vars (error printed to stderr)
 */

async function main() {
  try {
    // Dynamic import so env validation runs at import time
    await import("../apps/web/src/env.ts");
    console.log("✅ Environment validation passed");
    process.exit(0);
  } catch (err) {
    console.error("❌ Environment validation failed:");
    console.error(err.message || err);
    process.exit(1);
  }
}

main();
