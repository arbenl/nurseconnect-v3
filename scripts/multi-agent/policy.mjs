#!/usr/bin/env node
import { asBoolean, asNumber, asString, parseArgv, printHelpAndExit, printJson } from "./lib/cli.mjs";
import { loadMultiAgentConfig } from "./lib/config.mjs";
import { decideExecutionMode } from "./lib/policy-engine.mjs";

const HELP = `
Usage:
  node scripts/multi-agent/policy.mjs [options]

Options:
  --mode <auto|single|multi>               Explicit mode or auto policy (default: auto)
  --complexity <1-10>                      Task complexity signal
  --estimated-cost-usd <number>            Estimated run cost in USD
  --budget-usd <number>                    Budget cap in USD
  --independent-task-count <number>        Independent task count
  --requires-compliance-review <bool>      Whether compliance review is required
  --config <path>                          Config path (default: config/multi-agent.config.json)
  --json                                   Print JSON output (default: true)
  --help                                   Show this help text
`;

function main() {
  const parsed = parseArgv(process.argv.slice(2));
  if (parsed.help) {
    printHelpAndExit(HELP, 0);
  }

  const loaded = loadMultiAgentConfig({ configPath: asString(parsed.config, "") });

  const decision = decideExecutionMode(
    {
      mode: asString(parsed.mode, "auto"),
      complexity: asNumber(parsed.complexity, 0),
      estimatedCostUsd: asNumber(parsed["estimated-cost-usd"], 0),
      budgetUsd: asNumber(parsed["budget-usd"], 0),
      independentTaskCount: asNumber(parsed["independent-task-count"], 0),
      requiresComplianceReview: asBoolean(parsed["requires-compliance-review"], false),
    },
    loaded.config.policy || {}
  );

  const payload = {
    mode: decision.mode,
    score: decision.score,
    reasonCodes: decision.reasonCodes,
    thresholds: decision.thresholds,
    inputs: decision.inputs,
  };

  printJson(payload);
}

main();
