#!/usr/bin/env node
/**
 * Usage:
 *   node scripts/steer-run-and-verify.mjs <task-id> [--risk low|medium|high] [--include-optional] [--skip-verification-gates]
 *
 * Runs:
 *   node scripts/steer-run.mjs <task-id> --risk <risk>
 *   node scripts/steer-verify.mjs <task-id> --risk <risk>
 *   configured deterministic verification gates (for example pnpm gate:fast)
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const STEER_CONFIG_PATH = path.join(root, "steer", "steer.config.json");
const TASK_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function parseArgs(argv) {
  const parsed = {
    task: null,
    risk: process.env.RISK || "low",
    includeOptional: false,
    skipVerificationGates: process.env.SKIP_VERIFICATION_GATES === "1" || process.env.SKIP_VERIFICATION_GATES === "true",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--") && !parsed.task) {
      parsed.task = arg;
      continue;
    }

    if (arg === "--risk") {
      parsed.risk = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith("--risk=")) {
      parsed.risk = arg.split("=").at(1);
      continue;
    }

    if (arg === "--include-optional") {
      parsed.includeOptional = true;
      continue;
    }

    if (arg === "--skip-verification-gates") {
      parsed.skipVerificationGates = true;
      continue;
    }
  }

  return parsed;
}

function loadConfig() {
  const raw = readFileSync(STEER_CONFIG_PATH, "utf8");
  return JSON.parse(raw);
}

function runStep(command, args, label, task, risk) {
  const proc = spawnSync("node", [command, ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      RISK: risk,
      TASK: task,
    },
  });

  if (proc.status !== 0) {
    if (proc.status === null) {
      throw new Error(`${label} for task ${task} could not start`);
    }
    throw new Error(`${label} failed for task ${task} with exit code ${proc.status}`);
  }
}

function runCommand(command, task, risk) {
  const proc = spawnSync(command, {
    cwd: root,
    encoding: "utf8",
    shell: true,
    stdio: "pipe",
    env: {
      ...process.env,
      RISK: risk,
      TASK: task,
    },
  });

  return {
    command,
    status: proc.status === 0 ? "pass" : "fail",
    exitCode: proc.status ?? -1,
    stdout: (proc.stdout || "").slice(0, 6000),
    stderr: (proc.stderr || "").slice(0, 4000),
  };
}

function validateTask(task) {
  const normalizedTask = String(task || "");
  if (!TASK_ID_PATTERN.test(normalizedTask)) {
    console.error(
      `Invalid task id "${task}". Use a safe slug (letters, numbers, hyphen, underscore, dot) with no path separators.`
    );
    process.exit(1);
  }
  return normalizedTask;
}

function runVerificationGates(task, risk, options = {}) {
  const shouldSkip = Boolean(options.skip);
  const config = loadConfig();
  const configured = config.governance?.verificationGates || {};
  let commandList = configured[risk];
  if (!Array.isArray(commandList)) {
    const fallback = configured.default;
    if (typeof fallback === "string") {
      commandList = [fallback];
    } else if (Array.isArray(fallback)) {
      commandList = fallback;
    }
  }
  if (!Array.isArray(commandList)) {
    commandList = [];
  }

  const report = {
    task,
    risk,
    status: "pass",
    startedAt: new Date().toISOString(),
    skipped: false,
    steps: [],
  };

  if (shouldSkip) {
    report.status = "pass";
    report.skipped = true;
    report.skipReason = "Verification gates skipped by --skip-verification-gates or SKIP_VERIFICATION_GATES";
    report.completedAt = new Date().toISOString();
    const taskDir = path.join(root, "artifacts", task);
    mkdirSync(taskDir, { recursive: true });
    const reportPath = path.join(taskDir, config.governance?.verificationGate?.artifact || "verification-gates.json");
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
    return;
  }

  for (const command of commandList) {
    const step = runCommand(command, task, risk);
    report.steps.push(step);
    if (step.status === "fail") {
      report.status = "fail";
      report.error = `Command failed: ${command} (exitCode: ${step.exitCode})`;
      break;
    }
  }

  report.completedAt = new Date().toISOString();
  const taskDir = path.join(root, "artifacts", task);
  mkdirSync(taskDir, { recursive: true });
  const reportPath = path.join(taskDir, config.governance?.verificationGate?.artifact || "verification-gates.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");

  if (report.status === "fail") {
    throw new Error(`Verification gates failed for task ${task}`);
  }
}

function main() {
  const { task, risk, includeOptional, skipVerificationGates } = parseArgs(process.argv.slice(2));

  if (!task) {
    console.error("Usage: node scripts/steer-run-and-verify.mjs <task-id> [--risk low|medium|high]");
    process.exit(1);
  }
  const safeTask = validateTask(task);

  runStep(
    path.join(root, "scripts/steer-run.mjs"),
    [safeTask, "--risk", risk, ...(includeOptional ? ["--include-optional"] : [])],
    "Steer run",
    safeTask,
    risk
  );

  runVerificationGates(safeTask, risk, { skip: skipVerificationGates });

  runStep(
    path.join(root, "scripts/steer-verify.mjs"),
    [safeTask, "--risk", risk],
    "Steer verify",
    safeTask,
    risk
  );

  console.log(`✅ steer orchestrated execution complete for ${safeTask} (${risk})`);
}

main();
