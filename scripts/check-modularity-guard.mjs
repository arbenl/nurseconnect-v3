#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateModularityGuard } from "./lib/modularity-guard.mjs";
import { MODULARITY_LINE_LIMIT } from "./modularity-guard-policy.mjs";

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg.startsWith("--root=")) options.root = arg.slice("--root=".length);
    else if (arg === "--root") options.root = argv[++index];
    else if (arg.startsWith("--base=")) options.baseRef = arg.slice("--base=".length);
    else if (arg === "--base") options.baseRef = argv[++index];
    else if (arg === "--help" || arg === "-h") {
      process.stdout.write("Usage: node scripts/check-modularity-guard.mjs [--root <repo>] [--base <ref>]\n");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

export function runModularityGuard(options = {}) {
  const result = evaluateModularityGuard(options);
  if (result.status === "skipped") {
    process.stderr.write(`${result.warning}\n`);
    return 0;
  }

  if (result.violations.length === 0) {
    process.stdout.write(
      `Modularity guard passed: ${result.checkedFiles} changed text file(s) checked against ${result.base.ref}.\n`
    );
    return 0;
  }

  process.stderr.write(`Modularity guard failed: changed files must stay at or below ${MODULARITY_LINE_LIMIT} lines.\n`);
  for (const violation of result.violations) {
    const base = violation.baseLines == null ? "new" : `${violation.baseLines} base`;
    process.stderr.write(`- ${violation.file}: ${violation.currentLines} lines (${base}; ${violation.reason})\n`);
  }
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = runModularityGuard(parseArgs(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
