#!/usr/bin/env node
import { execFileSync } from "node:child_process";

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

const plans = [
  {
    table: "service_requests",
    sql: `UPDATE service_requests t SET organization_id='${ORG}', branch_id='${BRANCH}'
      WHERE t.ctid IN (SELECT ctid FROM service_requests WHERE organization_id IS NULL OR branch_id IS NULL LIMIT ${batchSize})`,
  },
  {
    table: "patients",
    sql: `UPDATE patients t SET organization_id='${ORG}'
      WHERE t.ctid IN (SELECT ctid FROM patients WHERE organization_id IS NULL LIMIT ${batchSize})`,
  },
  {
    table: "assignments",
    sql: `WITH batch AS (SELECT a.ctid, sr.organization_id FROM assignments a
      JOIN service_requests sr ON sr.id=a.request_id WHERE a.organization_id IS NULL LIMIT ${batchSize})
      UPDATE assignments a SET organization_id=batch.organization_id FROM batch WHERE a.ctid=batch.ctid`,
  },
  {
    table: "visits",
    sql: `WITH batch AS (SELECT v.ctid, sr.organization_id, sr.branch_id FROM visits v
      JOIN assignments a ON a.id=v.assignment_id JOIN service_requests sr ON sr.id=a.request_id
      WHERE v.organization_id IS NULL OR v.branch_id IS NULL LIMIT ${batchSize})
      UPDATE visits v SET organization_id=batch.organization_id, branch_id=batch.branch_id FROM batch WHERE v.ctid=batch.ctid`,
  },
  ...["service_request_events", "payment_authorizations", "nurse_payouts"].map((table) => ({
    table,
    sql: `WITH batch AS (SELECT t.ctid, sr.organization_id FROM ${table} t
      JOIN service_requests sr ON sr.id=t.request_id WHERE t.organization_id IS NULL LIMIT ${batchSize})
      UPDATE ${table} t SET organization_id=batch.organization_id FROM batch WHERE t.ctid=batch.ctid`,
  })),
];

const checks = [
  ["service_requests_null_org", "SELECT count(*) FROM service_requests WHERE organization_id IS NULL"],
  ["patients_null_org", "SELECT count(*) FROM patients WHERE organization_id IS NULL"],
  ["assignments_null_org", "SELECT count(*) FROM assignments WHERE organization_id IS NULL"],
  ["visits_null_org", "SELECT count(*) FROM visits WHERE organization_id IS NULL"],
  ["events_null_org", "SELECT count(*) FROM service_request_events WHERE organization_id IS NULL"],
  ["payment_authorizations_null_org", "SELECT count(*) FROM payment_authorizations WHERE organization_id IS NULL"],
  ["nurse_payouts_null_org", "SELECT count(*) FROM nurse_payouts WHERE organization_id IS NULL"],
  ["service_requests_null_branch", "SELECT count(*) FROM service_requests WHERE branch_id IS NULL"],
  ["visits_null_branch", "SELECT count(*) FROM visits WHERE branch_id IS NULL"],
  ["orphan_assignments", "SELECT count(*) FROM assignments a LEFT JOIN service_requests sr ON sr.id=a.request_id WHERE sr.id IS NULL"],
  ["orphan_visits", "SELECT count(*) FROM visits v LEFT JOIN assignments a ON a.id=v.assignment_id LEFT JOIN service_requests sr ON sr.id=a.request_id WHERE sr.id IS NULL"],
  ["orphan_events", "SELECT count(*) FROM service_request_events e LEFT JOIN service_requests sr ON sr.id=e.request_id WHERE sr.id IS NULL"],
  ["orphan_payment_authorizations", "SELECT count(*) FROM payment_authorizations p LEFT JOIN service_requests sr ON sr.id=p.request_id WHERE sr.id IS NULL"],
  ["orphan_nurse_payouts", "SELECT count(*) FROM nurse_payouts p LEFT JOIN service_requests sr ON sr.id=p.request_id WHERE sr.id IS NULL"],
];

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
  return checks.map(([name, sql]) => ({ name, count: countFrom(psql(timedTransaction(sql))) }));
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
