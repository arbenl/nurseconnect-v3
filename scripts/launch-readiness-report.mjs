#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readText(path) {
  return readFileSync(path, "utf8");
}

export const requiredScripts = [
  "env:check",
  "gate:release",
  "gate:e2e-api",
  "pr:finalizer",
  "guard:pr-comments",
  "launch:readiness",
  "launch:readiness:json",
  "launch:seed",
  "launch:rehearsal",
  "launch:monitor",
  "launch:auth-monitor",
];

export const requiredFiles = [
  "docs/runbooks/controlled_launch_execution_readiness.md",
  "docs/runbooks/production_bootstrap_runbook.md",
  "docs/runbooks/launch_readiness_review.md",
  "docs/runbooks/launch_day_card.md",
  "docs/v1.0.0-plan.md",
  "docs/superpowers/plans/2026-04-20-launch-readiness-review.md",
  "scripts/launch-rehearsal-seed.mjs",
  "scripts/launch-rehearsal.sh",
  "scripts/launch-monitor.mjs",
  "scripts/launch-auth-monitor.mjs",
  "apps/web/tests/e2e-api/launch-rehearsal.api.e2e.ts",
  "apps/web/tests/e2e-api/auth.api.e2e.ts",
  "apps/web/tests/e2e-api/authz.api.e2e.ts",
  "apps/web/tests/e2e-api/partner.api.e2e.ts",
  "apps/web/tests/e2e-api/admin-request-triage.api.e2e.ts",
  "apps/web/tests/e2e-api/admin-request-payments.api.e2e.ts",
  "apps/web/tests/e2e-api/admin-service-areas.api.e2e.ts",
  "apps/web/tests/e2e-api/requests.api.e2e.ts",
  "apps/web/tests/e2e-api/nurse.api.e2e.ts",
  "apps/web/tests/e2e-ui/smoke.spec.ts",
];

export const runbookRequirements = [
  "Required Production Preconditions",
  "Environment Tier Distinction",
  "Scope Truth",
  "Accepted Exclusions for v1.0.0 Launch",
  "Explicitly Out Of Scope For v1.0.0",
  "Required Validation Commands",
  "Rehearsal Seed",
  "Manual Launch Rehearsal",
  "Go/No-Go Checklist",
  "Controlled Launch Execution Decision",
  "Rollback Guidance",
];

export const controlledRunbookRequirements = [
  "Purpose",
  "Decision Inputs",
  "Hard Launch Gates",
  "Soft Launch Gates",
  "Decision Outcomes",
  "Operator Decision Ledger",
  "Post-Decision Handoff",
];

function addCheck(checks, name, passed, detail) {
  checks.push({ name, passed, detail });
}

export const requiredRunbookCommands = [
  "pnpm env:check",
  "pnpm launch:readiness",
  "pnpm launch:readiness:json",
  "pnpm launch:seed",
  "pnpm launch:rehearsal",
  "pnpm launch:monitor",
  "pnpm launch:auth-monitor",
  "pnpm gate:release",
];

function hasMarkdownSection(text, section) {
  return text.includes(`## ${section}`) || text.includes(`### ${section}`);
}

export function buildChecks(root = repoRoot) {
  const checks = [];
  const packageJson = readJson(resolve(root, "package.json"));

  for (const scriptName of requiredScripts) {
    addCheck(
      checks,
      `package script: ${scriptName}`,
      typeof packageJson.scripts?.[scriptName] === "string",
      packageJson.scripts?.[scriptName] || "missing",
    );
  }

  for (const file of requiredFiles) {
    addCheck(checks, `required file: ${file}`, existsSync(resolve(root, file)), file);
  }

  const runbookPath = resolve(root, "docs/runbooks/launch_readiness_review.md");
  const runbook = existsSync(runbookPath) ? readText(runbookPath) : "";
  for (const section of runbookRequirements) {
    addCheck(
      checks,
      `launch runbook section: ${section}`,
      hasMarkdownSection(runbook, section),
      section,
    );
  }

  const controlledRunbookPath = resolve(
    root,
    "docs/runbooks/controlled_launch_execution_readiness.md",
  );
  const controlledRunbook = existsSync(controlledRunbookPath)
    ? readText(controlledRunbookPath)
    : "";
  for (const section of controlledRunbookRequirements) {
    addCheck(
      checks,
      `controlled launch runbook section: ${section}`,
      hasMarkdownSection(controlledRunbook, section),
      section,
    );
  }

  for (const command of requiredRunbookCommands) {
    addCheck(
      checks,
      `launch runbook command: ${command}`,
      runbook.includes(command),
      command,
    );
  }

  return checks;
}

export function buildReport(root = repoRoot) {
  const checks = buildChecks(root);
  const failures = checks.filter((check) => !check.passed);

  return {
    passed: failures.length === 0,
    total: checks.length,
    failed: failures.length,
    failures: failures.map((check) => check.name),
    checks,
  };
}

function printJsonReport(report) {
  console.log(
    JSON.stringify(
      {
        passed: report.passed,
        total: report.total,
        failed: report.failed,
        failures: report.failures,
        checks: report.checks.map((check) => ({
          name: check.name,
          passed: check.passed,
          detail: check.detail,
        })),
      },
      null,
      2,
    ),
  );
}

function printHumanReport(report) {
  const maxNameLength = Math.max(...report.checks.map((check) => check.name.length));

  console.log("NurseConnect launch readiness report");
  console.log("");
  for (const check of report.checks) {
    const status = check.passed ? "PASS" : "FAIL";
    console.log(`${status} ${check.name.padEnd(maxNameLength)} ${check.detail}`);
  }

  if (!report.passed) {
    console.error("");
    console.error(`Launch readiness failed: ${report.failed} check(s) failed.`);
    return;
  }

  console.log("");
  console.log("Launch readiness checks passed.");
}

const entrypointPath = process.argv[1];

if (entrypointPath && import.meta.url === pathToFileURL(entrypointPath).href) {
  const report = buildReport(repoRoot);
  if (process.argv.includes("--json")) {
    printJsonReport(report);
  } else {
    printHumanReport(report);
  }
  process.exit(report.passed ? 0 : 1);
}
