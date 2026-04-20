#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readText(path) {
  return readFileSync(path, "utf8");
}

const packageJson = readJson(resolve(repoRoot, "package.json"));
const jsonFlag = process.argv.includes("--json");

const requiredScripts = [
  "env:check",
  "gate:release",
  "gate:e2e-api",
  "pr:finalizer",
  "guard:pr-comments",
  "launch:readiness",
  "launch:readiness:json",
  "launch:seed",
];

const requiredFiles = [
  "docs/runbooks/production_bootstrap_runbook.md",
  "docs/runbooks/launch_readiness_review.md",
  "docs/runbooks/launch_day_card.md",
  "docs/v1.0.0-plan.md",
  "docs/superpowers/plans/2026-04-20-launch-readiness-review.md",
  "scripts/launch-rehearsal-seed.mjs",
  "apps/web/tests/e2e-api/authz.api.e2e.ts",
  "apps/web/tests/e2e-api/partner.api.e2e.ts",
  "apps/web/tests/e2e-api/admin-request-triage.api.e2e.ts",
  "apps/web/tests/e2e-api/admin-request-payments.api.e2e.ts",
  "apps/web/tests/e2e-api/admin-service-areas.api.e2e.ts",
  "apps/web/tests/e2e-api/requests.api.e2e.ts",
  "apps/web/tests/e2e-api/nurse.api.e2e.ts",
  "apps/web/tests/e2e-ui/smoke.spec.ts",
];

const runbookRequirements = [
  "Required Production Preconditions",
  "Environment Tier Distinction",
  "Scope Truth",
  "Accepted Exclusions for v1.0.0 Launch",
  "Explicitly Out Of Scope For v1.0.0",
  "Required Validation Commands",
  "Rehearsal Seed",
  "Manual Launch Rehearsal",
  "Go/No-Go Checklist",
  "Rollback Guidance",
];

const checks = [];

function addCheck(name, passed, detail) {
  checks.push({ name, passed, detail });
}

for (const scriptName of requiredScripts) {
  addCheck(
    `package script: ${scriptName}`,
    typeof packageJson.scripts?.[scriptName] === "string",
    packageJson.scripts?.[scriptName] || "missing",
  );
}

for (const file of requiredFiles) {
  addCheck(`required file: ${file}`, existsSync(resolve(repoRoot, file)), file);
}

const runbookPath = resolve(repoRoot, "docs/runbooks/launch_readiness_review.md");
const runbook = existsSync(runbookPath) ? readText(runbookPath) : "";
for (const section of runbookRequirements) {
  addCheck(
    `launch runbook section: ${section}`,
    runbook.includes(`## ${section}`) || runbook.includes(`### ${section}`),
    section,
  );
}

for (const command of [
  "pnpm env:check",
  "pnpm launch:readiness",
  "pnpm launch:readiness:json",
  "pnpm launch:seed",
  "pnpm gate:release",
]) {
  addCheck(`launch runbook command: ${command}`, runbook.includes(command), command);
}

const failures = checks.filter((check) => !check.passed);

if (jsonFlag) {
  console.log(
    JSON.stringify(
      {
        passed: failures.length === 0,
        total: checks.length,
        failed: failures.length,
        failures: failures.map((check) => check.name),
        checks: checks.map((check) => ({
          name: check.name,
          passed: check.passed,
          detail: check.detail,
        })),
      },
      null,
      2,
    ),
  );
  process.exit(failures.length > 0 ? 1 : 0);
}

const maxNameLength = Math.max(...checks.map((check) => check.name.length));

console.log("NurseConnect launch readiness report");
console.log("");
for (const check of checks) {
  const status = check.passed ? "PASS" : "FAIL";
  console.log(`${status} ${check.name.padEnd(maxNameLength)} ${check.detail}`);
}

if (failures.length > 0) {
  console.error("");
  console.error(`Launch readiness failed: ${failures.length} check(s) failed.`);
  process.exit(1);
}

console.log("");
console.log("Launch readiness checks passed.");
