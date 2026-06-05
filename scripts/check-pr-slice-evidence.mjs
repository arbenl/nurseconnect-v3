#!/usr/bin/env node
import { readFileSync } from "node:fs";

import { validatePrSliceEvidence, verifyReferencedRunRoot } from "./lib/pr-slice-evidence.mjs";

export { validatePrSliceEvidence, verifyReferencedRunRoot } from "./lib/pr-slice-evidence.mjs";

const HELP = `
Usage:
  node scripts/check-pr-slice-evidence.mjs [options]

Options:
  --body-file <path>   Read PR body markdown from a file
  --files-json <path>  Read changed PR files as a JSON string array
  --verify-run-root    Re-run slice:evidence against the cited run root when artifacts are local
  --allow-missing-run-root
                       Skip run-root verification when artifacts are absent in CI
  --help               Show this help text
`;

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--") continue;
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = "true";
    }
  }
  return args;
}

function readInputs(args) {
  return {
    body: args["body-file"] ? readFileSync(args["body-file"], "utf8") : process.env.PR_BODY || "",
    files: args["files-json"] ? JSON.parse(readFileSync(args["files-json"], "utf8")) : JSON.parse(process.env.PR_FILES_JSON || "[]"),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    process.stdout.write(`${HELP.trim()}\n`);
    process.exit(0);
  }
  const { body, files } = readInputs(args);
  const result = validatePrSliceEvidence({ body, files });
  const runRootResult = args["verify-run-root"] ? verifyReferencedRunRoot({ body, files, allowMissing: args["allow-missing-run-root"] === "true" }) : null;
  const combined = {
    ...result,
    runRootVerification: runRootResult,
    status: result.status === "pass" && (!runRootResult || runRootResult.status === "pass") ? "pass" : "fail",
    errors: [...result.errors, ...(runRootResult?.errors || [])],
  };
  process.stdout.write(`${JSON.stringify(combined, null, 2)}\n`);
  if (combined.status !== "pass") process.exit(1);
}
