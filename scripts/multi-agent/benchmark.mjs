#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { asBoolean, asString, parseArgv, printHelpAndExit, printJson } from "./lib/cli.mjs";
import { loadMultiAgentConfig, resolveConfiguredPath, resolveRepoPath } from "./lib/config.mjs";
import { ensureDir } from "./lib/io.mjs";
import { runMultiAgentOrchestration } from "./lib/orchestrator.mjs";

const HELP = `
Usage:
  node scripts/multi-agent/benchmark.mjs [options]

Options:
  --execute <bool>                         Run real commands (default: false, dry-run benchmark)
  --weekly <bool>                          Tag output as weekly benchmark
  --output <path>                          Output markdown path
  --config <path>                          Config path (default: config/multi-agent.config.json)
  --help                                   Show this help text
`;

function formatRow(values) {
  return `| ${values.join(" | ")} |`;
}

function toFixedOrZero(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return value.toFixed(digits);
}

export async function runBenchmarkSuite(options = {}) {
  const loaded = loadMultiAgentConfig({ configPath: asString(options.configPath, "") });
  const scenarios = loaded.config.benchmark?.scenarios || [];
  const execute = Boolean(options.execute);
  const weekly = Boolean(options.weekly);

  if (scenarios.length === 0) {
    throw new Error("No benchmark scenarios configured.");
  }

  const rows = [];

  for (const scenario of scenarios) {
    const taskId = `benchmark-${scenario.id}`;
    const result = await runMultiAgentOrchestration({
      configPath: loaded.configPath,
      taskId,
      mode: scenario.mode || "auto",
      complexity: scenario.complexity,
      estimatedCostUsd: scenario.estimatedCostUsd,
      budgetUsd: scenario.budgetUsd,
      independentTaskCount: scenario.independentTaskCount,
      requiresComplianceReview: scenario.requiresComplianceReview,
      dryRun: !execute,
    });

    rows.push({
      scenario: scenario.id,
      mode: result.mode,
      status: result.status,
      runId: result.runId,
      metrics: result.scorecard.metrics,
      roleScorecard: result.roleScorecardPath,
    });
  }

  const header = [
    "Scenario",
    "Mode",
    "Status",
    "Success Rate",
    "Avg Latency (ms)",
    "P95 Latency (ms)",
    "Total Cost (USD)",
    "Quality/$",
  ];

  const markdownLines = [];
  markdownLines.push(`# Multi-Agent Benchmark Scorecard`);
  markdownLines.push("");
  markdownLines.push(`Generated: ${new Date().toISOString()}`);
  markdownLines.push(`Benchmark Type: ${weekly ? "weekly" : "manual"}`);
  markdownLines.push(`Execution Mode: ${execute ? "real commands" : "dry run"}`);
  markdownLines.push("");
  markdownLines.push(formatRow(header));
  markdownLines.push(formatRow(header.map(() => "---")));

  for (const row of rows) {
    markdownLines.push(
      formatRow([
        row.scenario,
        row.mode,
        row.status,
        toFixedOrZero(row.metrics.successRate, 4),
        toFixedOrZero(row.metrics.avgLatencyMs, 2),
        toFixedOrZero(row.metrics.p95LatencyMs, 2),
        toFixedOrZero(row.metrics.totalCostUsd, 4),
        toFixedOrZero(row.metrics.qualityPerDollar, 6),
      ])
    );
  }

  const benchmarkRoot = resolveConfiguredPath(
    loaded.repoRoot,
    loaded.config.paths?.benchmarkRoot,
    path.join("tmp", "multi-agent", "benchmarks")
  );
  const defaultOutput = path.join(
    benchmarkRoot,
    `${weekly ? "weekly" : "manual"}-${Date.now().toString(36)}`,
    loaded.config.benchmark?.scorecardFile || "scorecard.md"
  );
  const outputPath = options.output ? resolveRepoPath(loaded.repoRoot, options.output) : defaultOutput;

  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, `${markdownLines.join("\n")}\n`, "utf8");

  return {
    outputPath,
    rows,
  };
}

async function main() {
  const parsed = parseArgv(process.argv.slice(2));
  if (parsed.help) {
    printHelpAndExit(HELP, 0);
  }

  const result = await runBenchmarkSuite({
    execute: asBoolean(parsed.execute, false),
    weekly: asBoolean(parsed.weekly, false),
    output: asString(parsed.output, ""),
    configPath: asString(parsed.config, ""),
  });

  printJson(result);
}

const invokedScript = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedScript) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exit(1);
  });
}
