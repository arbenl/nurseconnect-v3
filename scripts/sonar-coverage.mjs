import { spawnSync } from "node:child_process";
import process from "node:process";

const coverageArgs = [
  "--coverage",
  "--coverage.include=src/**",
  "--coverage.reporter=text",
  "--coverage.reporter=json",
  "--coverage.reporter=lcov",
  "--coverage.reporter=json-summary",
];

const targets = [
  ["web", "vitest.config.ts"],
  ["@nurseconnect/contracts", "vitest.config.ts"],
  ["@nurseconnect/platform-telemetry", "vitest.config.ts"],
  ["@nurseconnect/domain-request", "vitest.config.ts"],
  ["@nurseconnect/domain-dispatch", "vitest.config.ts"],
  ["@nurseconnect/domain-identity", "vitest.config.ts"],
  ["@nurseconnect/domain-nurse", "vitest.config.ts"],
  ["@nurseconnect/domain-admin-ops", "vitest.config.ts"],
  ["@nurseconnect/domain-payments", "vitest.config.ts"],
  ["@nurseconnect/domain-visit", "vitest.config.ts"],
  ["@nurseconnect/domain-referral", "vitest.config.ts"],
];

const dbCoverageTargets = [
  {
    filter: "web",
    config: "vitest.config.node.ts",
    reportsDirectory: "coverage/node",
  },
  {
    filter: "@nurseconnect/domain-identity",
    config: "vitest.db.config.ts",
    reportsDirectory: "coverage/db",
  },
];

function runPnpm(args) {
  const result = spawnSync("pnpm", args, {
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function enforceTestDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return false;

  const parsed = new URL(databaseUrl);
  const dbName = parsed.pathname.replace(/^\//, "");
  if (!dbName) {
    throw new Error("Could not parse database name from DATABASE_URL");
  }

  if (!/(ci|test|gate)/.test(dbName)) {
    parsed.pathname = `/${dbName}_test`;
    process.env.DATABASE_URL = parsed.toString();
    console.log(`[sonar-coverage] DATABASE_URL pointed to ${dbName}; using ${dbName}_test`);
  }

  return true;
}

function runDbCoverageTargets() {
  if (!enforceTestDatabaseUrl()) {
    console.log("\n[sonar-coverage] skipping DB coverage targets; DATABASE_URL is not set");
    return;
  }

  console.log("\n[sonar-coverage] preparing clean database for DB coverage");
  runPnpm(["db:from-clean"]);

  for (const { filter, config, reportsDirectory } of dbCoverageTargets) {
    console.log(`\n[sonar-coverage] ${filter} DB coverage`);
    runPnpm([
      "--filter",
      filter,
      "exec",
      "vitest",
      "run",
      "--config",
      config,
      ...coverageArgs,
      `--coverage.reportsDirectory=${reportsDirectory}`,
    ]);
  }
}

console.log("\n[sonar-coverage] building @nurseconnect/contracts");
runPnpm(["--filter", "@nurseconnect/contracts", "build"]);

for (const [filter, config] of targets) {
  console.log(`\n[sonar-coverage] ${filter}`);
  runPnpm(["--filter", filter, "exec", "vitest", "run", "--config", config, ...coverageArgs]);
}

runDbCoverageTargets();
