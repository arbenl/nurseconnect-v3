#!/usr/bin/env node
import { asBoolean, asNumber, asString, parseArgv, printHelpAndExit, printJson } from "./lib/cli.mjs";
import { runMultiAgentOrchestration } from "./lib/orchestrator.mjs";

const HELP = `
Usage:
  node scripts/multi-agent/run.mjs [options]

Options:
  --task <id>                              Task identifier for this run
  --run-id <id>                            Optional explicit run id
  --mode <auto|single|multi>               Execution mode (default: auto)
  --complexity <1-10>                      Task complexity signal
  --estimated-cost-usd <number>            Estimated run cost in USD
  --budget-usd <number>                    Budget cap in USD
  --independent-task-count <number>        Independent task count
  --requires-compliance-review <bool>      Whether compliance review is required
  --dry-run <bool>                         Simulate commands without execution
  --config <path>                          Config path (default: config/multi-agent.config.json)
  --help                                   Show this help text
`;

async function main() {
  const parsed = parseArgv(process.argv.slice(2));
  if (parsed.help) {
    printHelpAndExit(HELP, 0);
  }

  const result = await runMultiAgentOrchestration({
    configPath: asString(parsed.config, ""),
    taskId: asString(parsed.task, "adhoc-task"),
    runId: asString(parsed["run-id"], "") || undefined,
    mode: asString(parsed.mode, "auto"),
    complexity: asNumber(parsed.complexity, 0),
    estimatedCostUsd: asNumber(parsed["estimated-cost-usd"], 0),
    budgetUsd: asNumber(parsed["budget-usd"], 0),
    independentTaskCount: asNumber(parsed["independent-task-count"], 0),
    requiresComplianceReview: asBoolean(parsed["requires-compliance-review"], false),
    dryRun: asBoolean(parsed["dry-run"], false),
  });

  printJson({
    runId: result.runId,
    mode: result.mode,
    status: result.status,
    policyReasonCodes: result.policyDecision.reasonCodes,
    runDirectory: result.runDirectory,
    events: result.eventsPath,
    roleScorecard: result.roleScorecardPath,
    metrics: result.scorecard.metrics,
  });

  if (result.status !== "pass") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
