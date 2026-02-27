#!/usr/bin/env node
import path from "node:path";

import { asString, parseArgv, printHelpAndExit, printJson } from "./lib/cli.mjs";
import { loadMultiAgentConfig, resolveConfiguredPath, resolveRepoPath } from "./lib/config.mjs";
import { getLatestDirectory, readNdjson } from "./lib/io.mjs";
import { calculateMetricsFromEvents } from "./lib/metrics.mjs";

const HELP = `
Usage:
  node scripts/multi-agent/metrics.mjs [options]

Options:
  --run-dir <path>                         Evaluate metrics from a specific run directory
  --events <path>                          Evaluate metrics from a specific events.ndjson file
  --config <path>                          Config path (default: config/multi-agent.config.json)
  --help                                   Show this help text
`;

function main() {
  const parsed = parseArgv(process.argv.slice(2));
  if (parsed.help) {
    printHelpAndExit(HELP, 0);
  }

  const loaded = loadMultiAgentConfig({ configPath: asString(parsed.config, "") });
  const tmpRoot = resolveConfiguredPath(
    loaded.repoRoot,
    loaded.config.paths?.tmpRoot,
    path.join("tmp", "multi-agent")
  );

  let eventsPath = "";

  if (parsed.events) {
    eventsPath = resolveRepoPath(loaded.repoRoot, asString(parsed.events, ""));
  } else if (parsed["run-dir"]) {
    const runDir = resolveRepoPath(loaded.repoRoot, asString(parsed["run-dir"], ""));
    eventsPath = path.join(runDir, loaded.config.paths?.eventsFile || "events.ndjson");
  } else {
    const latestRun = getLatestDirectory(tmpRoot);
    if (!latestRun) {
      throw new Error(`No run directories found under ${tmpRoot}`);
    }
    eventsPath = path.join(latestRun, loaded.config.paths?.eventsFile || "events.ndjson");
  }

  const events = readNdjson(eventsPath);
  const metrics = calculateMetricsFromEvents(events);

  printJson({
    eventsPath,
    metrics,
  });
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
}
