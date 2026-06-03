#!/usr/bin/env node

/**
 * Environment validation check.
 * Run: pnpm env:check
 *
 * Validates the Next.js app's env.ts module:
 * 1. Rejects removed platform env vars (hard error)
 * 2. Validates DATABASE_URL, BETTER_AUTH_SECRET, and feature flags
 *
 * Exit 0 = all vars present and valid
 * Exit 1 = missing or invalid vars (error printed to stderr)
 */

import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(__dirname, "../apps/web/src/env.ts");
const repoRoot = resolve(__dirname, "..");

export const MIN_PRODUCTION_AUTH_SECRET_LENGTH = 32;

export const AUTH_SECRET_PLACEHOLDER_TERMS = [
  "dev-secret",
  "do-not-use",
  "changeme",
  "placeholder",
  "replace-this",
  "your-",
];

export function isProductionLikeEnv(targetEnv) {
  return targetEnv.NODE_ENV === "production";
}

export function loadLocalEnv(targetEnv) {
  if (targetEnv.NC_ENV_CHECK_SKIP_LOCAL_FILES === "1") return;

  // Load in explicit order so app-local values win over repo-root defaults.
  const candidates = [
    resolve(repoRoot, ".env"),
    resolve(repoRoot, ".env.local"),
    resolve(repoRoot, "apps/web/.env"),
    resolve(repoRoot, "apps/web/.env.local"),
  ];

  const mergedFromFiles = {};
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const parsed = dotenv.parse(readFileSync(file));
    Object.assign(mergedFromFiles, parsed);
  }

  for (const [key, value] of Object.entries(mergedFromFiles)) {
    if (typeof targetEnv[key] === "undefined") {
      targetEnv[key] = value;
    }
  }
}

export function validateProductionSecretPosture(targetEnv) {
  if (!isProductionLikeEnv(targetEnv)) return;

  const authSecret = targetEnv.BETTER_AUTH_SECRET ?? "";
  const lowerSecret = authSecret.toLowerCase();

  if (authSecret.length < MIN_PRODUCTION_AUTH_SECRET_LENGTH) {
    throw new Error(
      `[env] BETTER_AUTH_SECRET must be at least ${MIN_PRODUCTION_AUTH_SECRET_LENGTH} characters in production.`
    );
  }

  if (AUTH_SECRET_PLACEHOLDER_TERMS.some((term) => lowerSecret.includes(term))) {
    throw new Error("[env] BETTER_AUTH_SECRET cannot use a local placeholder value in production.");
  }
}

export function runEnvCheck() {
  // Use tsx to run the TypeScript env module
  // NODE_ENV defaults to 'development' when running standalone (Next.js sets it automatically)
  const childEnv = { ...process.env };
  if (!childEnv.NODE_ENV) childEnv.NODE_ENV = "development";
  loadLocalEnv(childEnv);
  validateProductionSecretPosture(childEnv);

  execSync(`pnpm --filter @nurseconnect/database exec tsx -e "import('${envFile}')"`, {
    env: childEnv,
    stdio: ["pipe", "pipe", "pipe"],
    cwd: repoRoot,
  });
  console.log("✅ Environment validation passed");
}

function main() {
  try {
    runEnvCheck();
    process.exit(0);
  } catch (err) {
    console.error("❌ Environment validation failed:");
    const stderr = err.stderr?.toString?.() || err.message || String(err);
    // Extract the meaningful error message without printing full tool stack traces.
    const envError = stderr.match(/\[env\].*/)?.[0] || stderr;
    console.error(envError);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
