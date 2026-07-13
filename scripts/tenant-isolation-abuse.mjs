#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgv } from "./multi-agent/lib/cli.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const defaultContractPath = path.join(repoRoot, "config/tenant-isolation-contract.json");
const defaultMetaDir = path.join(repoRoot, "packages/database/drizzle/meta");

export const EXIT_OK = 0;
export const EXIT_FAIL = 1;
export const EXIT_SKIPPED = 2;

export const STATUS_PASS = "PASS";
export const STATUS_PENDING_SCHEMA = "ADVISORY_PASS_PENDING_SCHEMA", STATUS_PENDING_SCENARIOS = "ADVISORY_PASS_PENDING_SCENARIOS";
export const STATUS_FAIL = "FAIL";
export const STATUS_SKIPPED = "SKIPPED";

function usage() {
  return `
Usage: pnpm tenant:isolation -- [options]

Options:
  --mode readiness|guard|enforce
                              readiness is advisory; guard fails unsafe partial tenant tables; enforce requires full isolation.
  --source drizzle|live        drizzle reads the latest Drizzle snapshot; live inspects DATABASE_URL.
  --format text|json           output format.
  --contract <path>            contract JSON path.
  --meta-dir <path>            Drizzle metadata directory.

Exit codes:
  0  readiness completed, guard found no unsafe partial state, or enforce passed
  1  guard/enforce failed, invalid contract, or script error
  2  enforce was requested with --source live and no DATABASE_URL was configured
`;
}

function resolveRepoPath(value) {
  if (!value) return "";
  return path.isAbsolute(value) ? value : path.join(repoRoot, value);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function sortedFiles(dir, suffix) {
  return readdirSync(dir)
    .filter((file) => file.endsWith(suffix))
    .sort((left, right) => left.localeCompare(right));
}

export function loadContract(contractPath = defaultContractPath) {
  if (!existsSync(contractPath)) {
    const error = new Error(`Tenant isolation contract not found: ${contractPath}`);
    error.code = "MISSING_CONTRACT";
    throw error;
  }
  const contract = readJson(contractPath);
  validateContract(contract);
  return contract;
}

export function validateContract(contract) {
  const errors = [];
  if (!contract.version) errors.push("contract.version is required");
  if (contract.tenantKey !== "organization_id") errors.push("contract.tenantKey must be organization_id");
  if (!Array.isArray(contract.expectedTenantOwnedTables) || contract.expectedTenantOwnedTables.length === 0) {
    errors.push("expectedTenantOwnedTables must not be empty");
  }
  if (!Array.isArray(contract.requiredIsolationScenarios) || contract.requiredIsolationScenarios.length === 0) {
    errors.push("requiredIsolationScenarios must not be empty");
  }

  const tableNames = new Set();
  const boundaryTableNames = new Set();
  for (const table of contract.expectedTenantBoundaryTables ?? []) {
    if (!table.table) errors.push("expected tenant boundary table entry is missing table");
    if (boundaryTableNames.has(table.table)) errors.push(`duplicate expected boundary table: ${table.table}`);
    boundaryTableNames.add(table.table);
  }

  for (const table of contract.expectedTenantOwnedTables ?? []) {
    if (!table.table) errors.push("expected table entry is missing table");
    if (tableNames.has(table.table)) errors.push(`duplicate expected table: ${table.table}`);
    tableNames.add(table.table);
    if (boundaryTableNames.has(table.table)) {
      errors.push(`table cannot be both tenant boundary and tenant owned: ${table.table}`);
    }
    if (table.requiredTenantColumn !== contract.tenantKey) {
      errors.push(`${table.table} must require ${contract.tenantKey}`);
    }
  }

  const scenarioIds = new Set();
  for (const scenario of contract.requiredIsolationScenarios ?? []) {
    if (!scenario.id) errors.push("required scenario entry is missing id");
    if (scenarioIds.has(scenario.id)) errors.push(`duplicate required scenario: ${scenario.id}`);
    scenarioIds.add(scenario.id);
    if (!Array.isArray(scenario.assertionRefs)) {
      errors.push(`${scenario.id} must define assertionRefs`);
    }
    for (const assertionRef of scenario.assertionRefs ?? []) {
      if (!/^[^#]+#.+$/.test(assertionRef)) {
        errors.push(`${scenario.id} assertionRef must use file#test-name format`);
      }
    }
  }

  const deferredTableNames = new Set();
  for (const deferred of contract.deferredTenantTables ?? []) {
    if (!deferred.table || !deferred.reason) {
      errors.push("deferredTenantTables entries must define table and reason");
    }
    if (deferredTableNames.has(deferred.table)) {
      errors.push(`duplicate deferred table: ${deferred.table}`);
    }
    deferredTableNames.add(deferred.table);
    if (tableNames.has(deferred.table)) {
      errors.push(`table cannot be both expected and deferred: ${deferred.table}`);
    }
  }

  if (errors.length > 0) {
    const error = new Error(`Invalid tenant isolation contract: ${errors.join("; ")}`);
    error.code = "INVALID_CONTRACT";
    throw error;
  }
}

export function latestDrizzleSnapshotPath(metaDir = defaultMetaDir) {
  const journalPath = path.join(metaDir, "_journal.json");
  if (existsSync(journalPath)) {
    const journal = readJson(journalPath);
    const latest = [...(journal.entries ?? [])].sort((left, right) => Number(right.idx) - Number(left.idx)).at(0);
    if (latest?.idx !== undefined) {
      const snapshotPath = path.join(metaDir, `${String(latest.idx).padStart(4, "0")}_snapshot.json`);
      if (existsSync(snapshotPath)) return snapshotPath;
    }
  }

  const latestSnapshot = sortedFiles(metaDir, "_snapshot.json").at(-1);
  if (!latestSnapshot) {
    const error = new Error(`No Drizzle snapshot found in ${metaDir}`);
    error.code = "MISSING_SNAPSHOT";
    throw error;
  }
  return path.join(metaDir, latestSnapshot);
}

export function schemaInventoryFromDrizzleSnapshot(snapshot) {
  const tables = {};
  for (const [qualifiedName, table] of Object.entries(snapshot.tables ?? {})) {
    const tableName = table.name || qualifiedName.replace(/^public\./, "");
    tables[tableName] = {
      columns: Object.keys(table.columns ?? {}),
      rlsEnabled: Boolean(table.isRLSEnabled),
    };
  }
  return { source: "drizzle", tables };
}

export function loadDrizzleInventory(metaDir = defaultMetaDir) {
  const snapshotPath = latestDrizzleSnapshotPath(metaDir);
  return {
    ...schemaInventoryFromDrizzleSnapshot(readJson(snapshotPath)),
    snapshotPath: path.relative(repoRoot, snapshotPath),
  };
}

export async function loadLiveInventory(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    const error = new Error("DATABASE_URL is required for live tenant isolation inspection");
    error.code = "MISSING_DATABASE_URL";
    throw error;
  }

  let Client;
  try {
    ({ Client } = await import("pg"));
  } catch (error) {
    if (error.code === "ERR_MODULE_NOT_FOUND") {
      const dependencyError = new Error("The pg package is required for --source live");
      dependencyError.code = "PG_DEPENDENCY_MISSING";
      throw dependencyError;
    }
    throw error;
  }
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const columns = await client.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
    `);
    const rls = await client.query(`
      SELECT relname AS table_name, relrowsecurity AS rls_enabled
      FROM pg_class
      JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
      WHERE pg_namespace.nspname = 'public'
        AND pg_class.relkind IN ('r', 'p')
    `);

    const tables = {};
    for (const row of columns.rows) {
      tables[row.table_name] ??= { columns: [], rlsEnabled: false };
      tables[row.table_name].columns.push(row.column_name);
    }
    for (const row of rls.rows) {
      tables[row.table_name] ??= { columns: [], rlsEnabled: false };
      tables[row.table_name].rlsEnabled = Boolean(row.rls_enabled);
    }
    return { source: "live", tables };
  } finally {
    await client.end();
  }
}

function missingScenarioRefs(contract) {
  return contract.requiredIsolationScenarios
    .filter((scenario) => scenario.assertionRefs.length === 0)
    .map((scenario) => scenario.id);
}

function invalidAssertionRefs(contract) {
  const invalidRefs = [];
  for (const scenario of contract.requiredIsolationScenarios) {
    for (const assertionRef of scenario.assertionRefs) {
      const [file] = assertionRef.split("#");
      if (!existsSync(resolveRepoPath(file))) {
        invalidRefs.push({ scenario: scenario.id, assertionRef, reason: "missing_file" });
      }
    }
  }
  return invalidRefs;
}

export function evaluateTenantIsolation(contract, inventory) {
  validateContract(contract);
  const boundaryResults = (contract.expectedTenantBoundaryTables ?? []).map((expected) => {
    const actual = inventory.tables[expected.table];
    return {
      table: expected.table,
      classification: expected.classification,
      present: Boolean(actual),
      ready: Boolean(actual),
    };
  });
  const tableResults = contract.expectedTenantOwnedTables.map((expected) => {
    const actual = inventory.tables[expected.table];
    const columns = new Set(actual?.columns ?? []);
    const missingColumns = [];
    if (!columns.has(expected.requiredTenantColumn)) missingColumns.push(expected.requiredTenantColumn);
    for (const column of expected.requiredResourceColumns ?? []) {
      if (!columns.has(column)) missingColumns.push(column);
    }
    const missingRls = expected.rlsRequired && !actual?.rlsEnabled;
    const tenantSchemaStarted = columns.has(expected.requiredTenantColumn);
    return {
      table: expected.table,
      classification: expected.classification,
      present: Boolean(actual),
      missingColumns,
      rlsEnabled: Boolean(actual?.rlsEnabled),
      missingRls,
      tenantSchemaStarted,
      unsafePartial: tenantSchemaStarted && (missingColumns.length > 0 || missingRls),
      ready: Boolean(actual) && missingColumns.length === 0 && !missingRls,
    };
  });

  const schemaReady = tableResults.every((result) => result.ready);
  const boundaryReady = boundaryResults.every((result) => result.ready);
  const missingBoundaryTables = boundaryResults.filter((result) => !result.ready).map((result) => result.table);
  const unsafePartialTables = tableResults.filter((result) => result.unsafePartial).map((result) => result.table);
  const missingScenarios = missingScenarioRefs(contract);
  const invalidScenarioRefs = invalidAssertionRefs(contract);
  const scenarioReady = missingScenarios.length === 0 && invalidScenarioRefs.length === 0;
  const status =
    boundaryReady && schemaReady && scenarioReady
      ? STATUS_PASS
      : missingBoundaryTables.length > 0 ||
          unsafePartialTables.length > 0 ||
          invalidScenarioRefs.length > 0
        ? STATUS_FAIL
        : boundaryReady && schemaReady && !scenarioReady ? STATUS_PENDING_SCENARIOS
        : STATUS_PENDING_SCHEMA;

  return {
    status,
    contractVersion: contract.version,
    source: inventory.source,
    snapshotPath: inventory.snapshotPath,
    promotionTrigger: contract.promotionTrigger,
    tenantKey: contract.tenantKey,
    boundaryResults,
    tableResults,
    missingBoundaryTables,
    unsafePartialTables,
    missingScenarios,
    invalidScenarioRefs,
    deferredTenantTables: contract.deferredTenantTables ?? [],
    roleGuardrails: contract.roleGuardrails ?? [],
    summary: {
      expectedTables: tableResults.length,
      readyBoundaryTables: boundaryResults.filter((result) => result.ready).length,
      expectedBoundaryTables: boundaryResults.length,
      readyTables: tableResults.filter((result) => result.ready).length,
      missingScenarioAssertions: missingScenarios.length,
      invalidScenarioAssertions: invalidScenarioRefs.length,
    },
  };
}

export function exitCodeFor({ mode, status, errorCode }) {
  if (errorCode === "MISSING_DATABASE_URL") {
    if (mode === "enforce") return EXIT_SKIPPED;
    if (mode === "guard") return EXIT_FAIL;
    return EXIT_OK;
  }
  if (errorCode) return EXIT_FAIL;
  if (mode === "guard" && status === STATUS_FAIL) return EXIT_FAIL;
  if (mode === "enforce" && status !== STATUS_PASS) return EXIT_FAIL;
  return EXIT_OK;
}

function textReport(evaluation, mode) {
  const lines = [
    `[tenant-isolation] status=${evaluation.status} mode=${mode} source=${evaluation.source}`,
    `[tenant-isolation] contract=${evaluation.contractVersion} tenant_key=${evaluation.tenantKey}`,
  ];
  if (evaluation.snapshotPath) lines.push(`[tenant-isolation] snapshot=${evaluation.snapshotPath}`);
  lines.push(`[tenant-isolation] promotion_trigger=${evaluation.promotionTrigger}`);
  lines.push(
    `[tenant-isolation] boundary_tables=${evaluation.summary.readyBoundaryTables}/${evaluation.summary.expectedBoundaryTables} ready tables=${evaluation.summary.readyTables}/${evaluation.summary.expectedTables} ready missing_scenario_assertions=${evaluation.summary.missingScenarioAssertions} invalid_scenario_assertions=${evaluation.summary.invalidScenarioAssertions} tenant_scope_violations=external-e2e-required-zero`,
  );

  for (const result of evaluation.boundaryResults) {
    const gaps = result.present ? "none" : "missing_table";
    lines.push(`[tenant-isolation] boundary_table=${result.table} ready=${result.ready} gaps=${gaps}`);
  }

  for (const result of evaluation.tableResults) {
    const gaps = [
      ...result.missingColumns.map((column) => `missing_column:${column}`),
      ...(result.missingRls ? ["missing_rls"] : []),
      ...(!result.present ? ["missing_table"] : []),
    ];
    lines.push(
      `[tenant-isolation] table=${result.table} ready=${result.ready} tenant_schema_started=${result.tenantSchemaStarted} unsafe_partial=${result.unsafePartial} gaps=${gaps.join(",") || "none"}`,
    );
  }

  if (evaluation.missingScenarios.length > 0) {
    lines.push(`[tenant-isolation] missing_scenario_assertions=${evaluation.missingScenarios.join(",")}`);
  }
  for (const invalid of evaluation.invalidScenarioRefs) {
    lines.push(
      `[tenant-isolation] invalid_scenario_assertion=${invalid.scenario} ref=${invalid.assertionRef} reason=${invalid.reason}`,
    );
  }
  for (const deferred of evaluation.deferredTenantTables) {
    lines.push(`[tenant-isolation] deferred_table=${deferred.table} reason=${deferred.reason}`);
  }
  for (const guardrail of evaluation.roleGuardrails) {
    lines.push(`[tenant-isolation] role_guardrail=${guardrail.id} implemented_by=${guardrail.implementedBy.join(",")}`);
  }
  return `${lines.join("\n")}\n`;
}

function printResult(result, format, mode) {
  if (format === "json") {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (result.errorCode) {
    process.stderr.write(`[tenant-isolation] status=${STATUS_SKIPPED} mode=${mode} error=${result.errorCode} message=${result.message}\n`);
    return;
  }
  process.stdout.write(textReport(result, mode));
}

export async function runTenantIsolationCli(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgv(argv);
  if (args.help || args.h) {
    process.stdout.write(usage().trimStart());
    return EXIT_OK;
  }

  const mode = String(args.mode || "readiness");
  const source = String(args.source || "drizzle");
  const format = String(args.format || "text");
  if (!["readiness", "guard", "enforce"].includes(mode)) throw new Error(`Unsupported mode: ${mode}`);
  if (!["drizzle", "live"].includes(source)) throw new Error(`Unsupported source: ${source}`);
  if (!["text", "json"].includes(format)) throw new Error(`Unsupported format: ${format}`);

  try {
    const contract = loadContract(resolveRepoPath(args.contract) || defaultContractPath);
    const inventory =
      source === "live"
        ? await loadLiveInventory(env.DATABASE_URL)
        : loadDrizzleInventory(resolveRepoPath(args["meta-dir"]) || defaultMetaDir);
    const evaluation = evaluateTenantIsolation(contract, inventory);
    printResult(evaluation, format, mode);
    return exitCodeFor({ mode, status: evaluation.status });
  } catch (error) {
    const errorResult = {
      status: STATUS_SKIPPED,
      mode,
      source,
      errorCode: error.code || "SCRIPT_ERROR",
      message: error.message,
    };
    printResult(errorResult, format, mode);
    return exitCodeFor({ mode, errorCode: errorResult.errorCode });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runTenantIsolationCli()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stderr.write(`[tenant-isolation] FAIL ${error.message}\n`);
      process.exitCode = EXIT_FAIL;
    });
}
