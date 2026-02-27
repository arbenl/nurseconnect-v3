#!/usr/bin/env node
import path from "node:path";

import { asBoolean, asNumber, asString, parseArgv, printHelpAndExit, printJson } from "./lib/cli.mjs";
import { loadMultiAgentConfig, resolveConfiguredPath } from "./lib/config.mjs";
import { runShellCommand } from "./lib/command-runner.mjs";
import { ensureDir, writeJson } from "./lib/io.mjs";

const HELP = `
Usage:
  node scripts/multi-agent/verify-fix.mjs [options]

Options:
  --max-retries <number>                   Override retry count for verification lane
  --dry-run <bool>                         Simulate commands without execution
  --config <path>                          Config path (default: config/multi-agent.config.json)
  --help                                   Show this help text
`;

async function runCommandGroup(commands, options) {
  const results = [];
  for (const command of commands) {
    const result = await runShellCommand(command, options);
    results.push({
      command,
      status: result.status,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      timedOut: result.timedOut,
      stdout: (result.stdout || "").slice(0, 4000),
      stderr: (result.stderr || "").slice(0, 2000),
    });
    if (result.status !== "pass") {
      break;
    }
  }
  return results;
}

async function main() {
  const parsed = parseArgv(process.argv.slice(2));
  if (parsed.help) {
    printHelpAndExit(HELP, 0);
  }

  const loaded = loadMultiAgentConfig({ configPath: asString(parsed.config, "") });
  const verificationCommands = loaded.config.gates?.verificationCommands || [];
  const remediationCommands = loaded.config.gates?.verificationRemediationCommands || [];

  if (verificationCommands.length === 0) {
    throw new Error("No verification commands configured in config/multi-agent.config.json");
  }

  const timeoutMs = Number(loaded.config.retryLimits?.commandTimeoutMs || 300000);
  const maxRetries = asNumber(parsed["max-retries"], Number(loaded.config.retryLimits?.verificationAgent || 2));
  const dryRun = asBoolean(parsed["dry-run"], false);

  const report = {
    startedAt: new Date().toISOString(),
    status: "fail",
    attempts: [],
    maxRetries,
  };

  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    const verifyResults = await runCommandGroup(verificationCommands, {
      cwd: loaded.repoRoot,
      timeoutMs,
      dryRun,
    });

    const verifyPassed = verifyResults.every((result) => result.status === "pass");
    const attemptReport = {
      attempt,
      verification: verifyResults,
      remediation: [],
      status: verifyPassed ? "pass" : "fail",
    };

    if (verifyPassed) {
      report.attempts.push(attemptReport);
      report.status = "pass";
      break;
    }

    if (attempt <= maxRetries && remediationCommands.length > 0) {
      attemptReport.remediation = await runCommandGroup(remediationCommands, {
        cwd: loaded.repoRoot,
        timeoutMs,
        dryRun,
      });
    }

    report.attempts.push(attemptReport);
  }

  report.completedAt = new Date().toISOString();

  const outputRoot = resolveConfiguredPath(
    loaded.repoRoot,
    loaded.config.paths?.tmpRoot,
    path.join("tmp", "multi-agent")
  );
  const outputPath = path.join(outputRoot, `verify-fix-${Date.now().toString(36)}.json`);
  ensureDir(outputRoot);
  writeJson(outputPath, report);

  printJson({
    status: report.status,
    outputPath,
    attempts: report.attempts.length,
  });

  if (report.status !== "pass") {
    process.exit(1);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
