#!/usr/bin/env node
import path from "node:path";

import { asBoolean, asString, parseArgv, printHelpAndExit, printJson } from "./lib/cli.mjs";
import { loadMultiAgentConfig, resolveConfiguredPath, resolveRepoPath } from "./lib/config.mjs";
import { ensureDir } from "./lib/io.mjs";
import { persistFinalizerReport, runFinalizerChecks } from "./lib/finalizer.mjs";

const HELP = `
Usage:
  node scripts/multi-agent/finalizer.mjs [options]

Options:
  --allow-dirty <bool>                     Skip clean tree failure
  --run-local-checks <bool>                Run local check commands from config
  --ci-snapshot-command <command>          Override configured CI snapshot command
  --output <path>                          Output report path
  --config <path>                          Config path (default: config/multi-agent.config.json)
  --help                                   Show this help text
`;

function main() {
  const parsed = parseArgv(process.argv.slice(2));
  if (parsed.help) {
    printHelpAndExit(HELP, 0);
  }

  const loaded = loadMultiAgentConfig({ configPath: asString(parsed.config, "") });

  const finalizerRoot = resolveConfiguredPath(
    loaded.repoRoot,
    loaded.config.paths?.finalizerRoot,
    path.join("tmp", "multi-agent", "finalizer")
  );
  ensureDir(finalizerRoot);

  const defaultOutputPath = path.join(finalizerRoot, `finalizer-${Date.now().toString(36)}.json`);
  const outputPath = parsed.output
    ? resolveRepoPath(loaded.repoRoot, asString(parsed.output, ""))
    : defaultOutputPath;

  const finalizerConfig = {
    ...(loaded.config.finalizer || {}),
    ...(parsed["ci-snapshot-command"]
      ? { ciSnapshotCommand: asString(parsed["ci-snapshot-command"], "") }
      : {}),
  };

  const report = runFinalizerChecks({
    repoRoot: loaded.repoRoot,
    finalizerConfig,
    runLocalChecks: asBoolean(parsed["run-local-checks"], false),
    allowDirty: asBoolean(parsed["allow-dirty"], false),
    outputDirectory: finalizerRoot,
  });

  persistFinalizerReport(report, outputPath);

  printJson({
    status: report.status,
    outputPath,
    checks: report.checks,
  });

  if (report.status !== "pass") {
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
}
