#!/usr/bin/env node

import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const requireFromDatabase = createRequire(resolve(repoRoot, "packages/database/package.json"));

export const queries = Object.freeze({
  shellUsers: "SELECT id, role, auth_id, created_at FROM users WHERE auth_id IS NULL ORDER BY created_at ASC LIMIT $1",
  missingAuthUsers:
    "SELECT u.id, u.role, u.auth_id, u.created_at FROM users u LEFT JOIN auth_users au ON au.id = u.auth_id WHERE u.auth_id IS NOT NULL AND au.id IS NULL ORDER BY u.created_at ASC LIMIT $1",
  missingDomainUsers:
    "SELECT au.id AS auth_id, NULL AS role, au.created_at FROM auth_users au LEFT JOIN users u ON u.auth_id = au.id WHERE u.id IS NULL ORDER BY au.created_at ASC LIMIT $1",
  shellUsersCount: "SELECT COUNT(*)::int AS count FROM users WHERE auth_id IS NULL",
  missingAuthUsersCount:
    "SELECT COUNT(*)::int AS count FROM users u LEFT JOIN auth_users au ON au.id = u.auth_id WHERE u.auth_id IS NOT NULL AND au.id IS NULL",
  missingDomainUsersCount:
    "SELECT COUNT(*)::int AS count FROM auth_users au LEFT JOIN users u ON u.auth_id = au.id WHERE u.id IS NULL",
});

const policy = {
  shellUsers: "Allowed only for pre-auth patient/referral invite shells until shell lifecycle redesign.",
  missingAuthUsers: "Invalid before FK enforcement; fix, backfill, or remove these rows.",
  missingDomainUsers: "Temporarily tolerated; resolveSessionUser must create or claim a projection on first app access.",
};

export function loadLocalEnv() {
  let loaded = 0;
  for (const file of [".env", ".env.local", "apps/web/.env", "apps/web/.env.local"]) {
    const path = resolve(repoRoot, file);
    if (!existsSync(path)) continue;
    loaded += 1;
    const parsed = dotenv.parse(readFileSync(path));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
  return loaded;
}

export function parseArgs(argv) {
  const options = { json: false, includeIdentifiers: false, limit: 25 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    else if (arg === "--json") options.json = true;
    else if (arg === "--include-identifiers") options.includeIdentifiers = true;
    else if (arg === "--limit") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--limit requires a value");
      options.limit = Number(value);
      index += 1;
    }
    else if (arg === "-h" || arg === "--help") options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  const ciEnabled = Boolean(process.env.CI) && !["0", "false"].includes(process.env.CI.toLowerCase());
  if (options.includeIdentifiers && ciEnabled) {
    throw new Error("--include-identifiers is forbidden in CI");
  }
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 500) {
    throw new Error("--limit must be an integer from 1 to 500");
  }
  return options;
}

export function redactRows(rows, includeIdentifiers) {
  return rows.map((row) => {
    const safe = { role: row.role ?? null, createdAt: row.created_at ?? row.createdAt ?? null };
    if (!includeIdentifiers) return safe;
    return {
      ...safe,
      userId: row.id ?? null,
      authId: row.auth_id ?? row.authId ?? null,
    };
  });
}

export function buildReport(results, options = {}) {
  const includeIdentifiers = Boolean(options.includeIdentifiers);
  const stagedMigrationPlan = [
    "Observe counts in non-production and production-safe local evidence.",
    "Resolve missing auth rows before adding FK.",
    "Move pre-auth invite shells to a dedicated lifecycle or exempted table.",
    "Add FK from users.auth_id to auth_users.id once missingAuthUsers is zero.",
    "Add NOT NULL only after shellUsers is zero or no longer stored in users.",
  ];

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    report: "identity-auth-bridge-reconciliation",
    counts: {
      shellUsers: results.counts?.shellUsers ?? results.shellUsers.length,
      missingAuthUsers: results.counts?.missingAuthUsers ?? results.missingAuthUsers.length,
      missingDomainUsers: results.counts?.missingDomainUsers ?? results.missingDomainUsers.length,
    },
    samples: {
      shellUsers: redactRows(results.shellUsers, includeIdentifiers),
      missingAuthUsers: redactRows(results.missingAuthUsers, includeIdentifiers),
      missingDomainUsers: redactRows(results.missingDomainUsers, includeIdentifiers),
    },
    policy,
    stagedMigrationPlan,
  };
}

export async function collectReconciliation(client, options = {}) {
  const limit = options.limit ?? 25;
  const [
    shellUsers,
    missingAuthUsers,
    missingDomainUsers,
    shellUsersCount,
    missingAuthUsersCount,
    missingDomainUsersCount,
  ] = await Promise.all([
    client.query(queries.shellUsers, [limit]),
    client.query(queries.missingAuthUsers, [limit]),
    client.query(queries.missingDomainUsers, [limit]),
    client.query(queries.shellUsersCount),
    client.query(queries.missingAuthUsersCount),
    client.query(queries.missingDomainUsersCount),
  ]);
  return {
    shellUsers: shellUsers.rows,
    missingAuthUsers: missingAuthUsers.rows,
    missingDomainUsers: missingDomainUsers.rows,
    counts: {
      shellUsers: Number(shellUsersCount.rows[0]?.count ?? shellUsers.rows.length),
      missingAuthUsers: Number(missingAuthUsersCount.rows[0]?.count ?? missingAuthUsers.rows.length),
      missingDomainUsers: Number(missingDomainUsersCount.rows[0]?.count ?? missingDomainUsers.rows.length),
    },
  };
}

export function formatText(report) {
  return [
    `Identity auth bridge reconciliation (${report.generatedAt})`,
    `shellUsers=${report.counts.shellUsers}`,
    `missingAuthUsers=${report.counts.missingAuthUsers}`,
    `missingDomainUsers=${report.counts.missingDomainUsers}`,
    "samples: JSON includes bounded samples with identifiers redacted by default",
    "",
    "Policy:",
    `- shellUsers: ${report.policy.shellUsers}`,
    `- missingAuthUsers: ${report.policy.missingAuthUsers}`,
    `- missingDomainUsers: ${report.policy.missingDomainUsers}`,
    "",
    "Staged migration plan:",
    ...report.stagedMigrationPlan.map((step) => `- ${step}`),
  ].join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write("Usage: pnpm identity:reconcile -- [--json] [--include-identifiers] [--limit 25]\n");
    return;
  }
  const loadedEnvFiles = loadLocalEnv();
  if (loadedEnvFiles === 0 && !process.env.DATABASE_URL) {
    process.stderr.write("[identity-reconcile] No repo-local env file found.\n");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required; set it in the environment or a repo-local .env file");
  }
  const { Client } = requireFromDatabase("pg");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const results = await collectReconciliation(client, options);
    const report = buildReport(results, options);
    process.stdout.write(options.json ? `${JSON.stringify(report, null, 2)}\n` : `${formatText(report)}\n`);
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`[identity-reconcile] FAIL: ${error.message}\n`);
    process.exit(1);
  });
}
