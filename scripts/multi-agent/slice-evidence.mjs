#!/usr/bin/env node
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { asBoolean, asString, parseArgv, printHelpAndExit, printJson } from "./lib/cli.mjs";
import { checkModelAccess, checkModelPreflight, checkModelReview, checkNurseConnectQa, checkSubagentHandoff, checkSubagentResults } from "./lib/slice-evidence-checks.mjs";
import { checkFile, fail, pass, resolveRepoPath, splitList } from "./lib/slice-evidence-shared.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const HELP = `
Usage:
  node scripts/multi-agent/slice-evidence.mjs --run-root <path> [options]

Options:
  --run-root <path>             verify-slice run root
  --require-model-preflight     Fail unless model route preflight evidence passed
  --require-model-access        Fail unless model route access-check evidence passed
  --require-model-review        Fail unless model-review receipts exist
  --require-subagent-results    Fail unless subagent reviewer result receipts pass
  --require-reviewers <list>    Comma list of model reviewer routes that must be present
  --require-debate              Fail unless debate evidence exists
  --allow-dry-run               Count dry-run model-review receipts as acceptable
  --must-fix-disposition <text> Required when model debate found MUST_FIX candidates
  --output <path>               Optional JSON report path
`;

function optionsFrom(parsed) {
  return {
    requireModelPreflight: asBoolean(parsed["require-model-preflight"], false),
    requireModelAccess: asBoolean(parsed["require-model-access"], false),
    requireModelReview: asBoolean(parsed["require-model-review"], false),
    requireSubagentResults: asBoolean(parsed["require-subagent-results"], false),
    requiredReviewers: splitList(parsed["require-reviewers"]),
    requireDebate: asBoolean(parsed["require-debate"], false),
    allowDryRun: asBoolean(parsed["allow-dry-run"], false),
    mustFixDisposition: asString(parsed["must-fix-disposition"], ""),
  };
}

async function main() {
  const parsed = parseArgv(process.argv.slice(2));
  if (parsed.help || parsed.h) printHelpAndExit(HELP, 0);
  const runRoot = resolveRepoPath(repoRoot, asString(parsed["run-root"], ""));
  if (!runRoot) {
    process.stderr.write("[slice-evidence] FAIL: --run-root is required\n");
    process.exit(1);
  }
  const options = optionsFrom(parsed);
  const checks = {
    runRoot: existsSync(runRoot) ? pass("run root exists", { path: runRoot }) : fail("run root is missing", { path: runRoot }),
    manifest: checkFile("verify-slice manifest", path.join(runRoot, "run-manifest.md")),
    reviewerPlan: checkFile("reviewer plan", path.join(runRoot, "reviewer-plan.md")),
  };
  if (checks.runRoot.status === "pass") {
    checks.nurseconnectQa = await checkNurseConnectQa(runRoot);
    checks.subagentHandoff = await checkSubagentHandoff(runRoot);
    checks.subagentResults = await checkSubagentResults(runRoot, options);
    checks.modelPreflight = await checkModelPreflight(runRoot, options);
    checks.modelAccess = await checkModelAccess(runRoot, options);
    checks.modelReview = await checkModelReview(runRoot, options);
  }
  const report = { status: Object.values(checks).every((check) => check.status === "pass") ? "pass" : "fail", runRoot, options, checks };
  const output = resolveRepoPath(repoRoot, asString(parsed.output, ""));
  if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  printJson(report);
  if (report.status !== "pass") process.exit(1);
}

main().catch((error) => {
  process.stderr.write(`[slice-evidence] FAIL: ${error.stack || error.message}\n`);
  process.exit(1);
});
