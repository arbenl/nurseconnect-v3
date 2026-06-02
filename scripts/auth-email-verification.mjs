#!/usr/bin/env node

import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const requireFromDatabase = createRequire(resolve(repoRoot, "packages/database/package.json"));
const { Client } = requireFromDatabase("pg");

function loadLocalEnv() {
  const candidates = [
    resolve(repoRoot, ".env"),
    resolve(repoRoot, ".env.local"),
    resolve(repoRoot, "apps/web/.env"),
    resolve(repoRoot, "apps/web/.env.local"),
  ];

  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const parsed = dotenv.parse(readFileSync(file));
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof process.env[key] === "undefined") {
        process.env[key] = value;
      }
    }
  }
}

function parseArgs(argv) {
  const args = { command: argv[2] ?? "report", allowlistFile: "" };
  for (let index = 3; index < argv.length; index += 1) {
    if (argv[index] === "--allowlist-file") {
      args.allowlistFile = argv[index + 1] ?? "";
      index += 1;
    }
  }
  return args;
}

function parseAllowlist(file) {
  if (!file) {
    throw new Error("--allowlist-file is required for apply.");
  }
  const path = resolve(process.cwd(), file);
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  const emails = [];
  const invalidLines = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }
    if (trimmed !== trimmed.toLowerCase() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      invalidLines.push(index + 1);
      return;
    }
    emails.push(trimmed);
  });

  if (invalidLines.length > 0) {
    throw new Error(`Invalid allowlist entries at lines: ${invalidLines.join(", ")}`);
  }

  return Array.from(new Set(emails));
}

async function report(client) {
  const result = await client.query(
    `SELECT
       COUNT(*)::int AS total_auth_users,
       COUNT(*) FILTER (WHERE email_verified = false)::int AS unverified_auth_users,
       COUNT(*) FILTER (WHERE email_verified = true)::int AS verified_auth_users
     FROM auth_users`,
  );
  const row = result.rows[0];
  console.log("Email verification report");
  console.log(`total_auth_users=${row.total_auth_users}`);
  console.log(`verified_auth_users=${row.verified_auth_users}`);
  console.log(`unverified_auth_users=${row.unverified_auth_users}`);
}

async function applyAllowlist(client, emails) {
  await client.query("BEGIN");
  try {
    const matched = await client.query(
      "SELECT COUNT(*)::int AS matched FROM auth_users WHERE lower(email) = ANY($1::text[])",
      [emails],
    );
    const updated = await client.query(
      `UPDATE auth_users
          SET email_verified = true,
              email_verified_at = COALESCE(email_verified_at, NOW()),
              updated_at = NOW()
        WHERE lower(email) = ANY($1::text[])
          AND email_verified = false`,
      [emails],
    );
    await client.query("COMMIT");
    console.log("Email verification backfill complete");
    console.log(`allowlist_entries=${emails.length}`);
    console.log(`matched_auth_users=${matched.rows[0].matched}`);
    console.log(`updated_auth_users=${updated.rowCount}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  loadLocalEnv();
  const args = parseArgs(process.argv);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    if (args.command === "report") {
      await report(client);
      return;
    }
    if (args.command === "apply") {
      const emails = parseAllowlist(args.allowlistFile);
      await applyAllowlist(client, emails);
      return;
    }
    throw new Error(`Unknown command: ${args.command}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Email verification tooling failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
