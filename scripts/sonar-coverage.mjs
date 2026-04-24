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

console.log("\n[sonar-coverage] building @nurseconnect/contracts");
runPnpm(["--filter", "@nurseconnect/contracts", "build"]);

for (const [filter, config] of targets) {
  console.log(`\n[sonar-coverage] ${filter}`);
  runPnpm(["--filter", filter, "exec", "vitest", "run", "--config", config, ...coverageArgs]);
}
