#!/usr/bin/env node
import { execFileSync } from "node:child_process";

import { libpqTransportEnvironment } from "./lib/tenant-backfill-connection.mjs";
import { tenantBackfillChecks, tenantBackfillPlans } from "./lib/tenant-backfill-plan.mjs";

const ORG = "00000000-0000-4000-8000-000000000001";
const BRANCH = "00000000-0000-4000-8000-000000000101";
const args = new Set(process.argv.slice(2));
const batchSize = Number(process.env.NC_TB_01_BACKFILL_BATCH_SIZE || 1000);
const lockTimeout = timeoutValue("NC_TB_01_BACKFILL_LOCK_TIMEOUT", "5s");
const statementTimeout = timeoutValue("NC_TB_01_BACKFILL_STATEMENT_TIMEOUT", "60s");

if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 10000) {
  throw new Error("NC_TB_01_BACKFILL_BATCH_SIZE must be an integer from 1 to 10000");
}

function databaseUrl() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  return process.env.DATABASE_URL;
}

function psql(sql) {
  const url = new URL(databaseUrl());
  return execFileSync(process.env.PSQL_BIN || "psql", [
    "-X",
    "-qAt",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    sql,
  ], {
    encoding: "utf8",
    env: {
      ...process.env,
      PGHOST: url.hostname,
      PGPORT: url.port || "5432",
      PGDATABASE: url.pathname.slice(1),
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
      ...libpqTransportEnvironment(url),
    },
  }).trim();
}

function countFrom(output) {
  const match = output.match(/(\d+)\s*$/);
  return match ? Number(match[1]) : 0;
}

function timeoutValue(name, fallback) {
  const value = process.env[name] || fallback;
  if (!/^[1-9][0-9]*(ms|s|min)?$/.test(value)) {
    throw new Error(`${name} must be a positive duration like 500ms, 5s, or 1min`);
  }
  return value;
}

function timedTransaction(body) {
  return [`BEGIN`, `SET LOCAL lock_timeout = '${lockTimeout}'`, `SET LOCAL statement_timeout = '${statementTimeout}'`, body, "COMMIT"].join(";");
}

const plans = tenantBackfillPlans(ORG, BRANCH, batchSize);

function applyBackfill() {
  const updates = [];
  for (const plan of plans) {
    let rows = 0;
    for (;;) {
      const count = countFrom(psql(timedTransaction(`WITH updated AS (${plan.sql} RETURNING 1) SELECT count(*) FROM updated`)));
      rows += count;
      if (count === 0) break;
    }
    updates.push({ table: plan.table, rows });
  }
  return updates;
}

function runChecks() {
  return tenantBackfillChecks(ORG, BRANCH).map(([name, sql]) => ({
    name,
    count: countFrom(psql(timedTransaction(sql))),
  }));
}

try {
  const updates = args.has("--check-only") ? [] : applyBackfill();
  const reconciliation = runChecks();
  const failed = reconciliation.filter((row) => row.count !== 0);
  process.stdout.write(`${JSON.stringify({
    status: failed.length === 0 ? "pass" : "fail",
    batchSize,
    lockTimeout,
    statementTimeout,
    updates,
    reconciliation,
  }, null, 2)}\n`);
  if (failed.length > 0) process.exitCode = 1;
} catch (error) {
  const message = error instanceof Error && error.message === "DATABASE_URL is required"
    ? error.message
    : "backfill tenant ownership failed; see psql stderr above";
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
