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
import { existsSync, readFileSync } from "node:fs";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(__dirname, "../apps/web/src/env.ts");
const repoRoot = resolve(__dirname, "..");

function loadLocalEnv(targetEnv) {
  // Load in explicit order so app-local values win over repo-root defaults.
  const candidates = [
    resolve(repoRoot, ".env"),
    resolve(repoRoot, ".env.local"),
    resolve(repoRoot, "apps/web/.env"),
    resolve(repoRoot, "apps/web/.env.local"),
  ];

  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const parsed = dotenv.parse(readFileSync(file));
    Object.assign(targetEnv, parsed);
  }
}

try {
  // Use tsx to run the TypeScript env module
  // NODE_ENV defaults to 'development' when running standalone (Next.js sets it automatically)
  const childEnv = { ...process.env };
  if (!childEnv.NODE_ENV) childEnv.NODE_ENV = "development";
  loadLocalEnv(childEnv);
  execSync(`pnpm --filter @nurseconnect/database exec tsx -e "import('${envFile}')"`, {
    env: childEnv,
    stdio: ["pipe", "pipe", "pipe"],
    cwd: repoRoot,
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
