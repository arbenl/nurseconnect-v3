#!/usr/bin/env node
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { asString, parseArgv, printHelpAndExit, printJson } from "./lib/cli.mjs";
import { readJson, resolveRepoPath, validMustFixDisposition } from "./lib/slice-evidence-shared.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const verdicts = ["READY FOR PR AFTER MUST-FIX ITEMS", "NOT READY FOR PR", "READY FOR PR"];
const HELP = `
Usage:
  node scripts/multi-agent/subagent-results.mjs --run-root <path> [options]

Options:
  --run-root <path>                 verify-slice run root
  --must-fix-disposition <text>     none, all fixed, or rejected:<reason>
`;

function reviewerName(item) {
  return typeof item === "string" ? item : item?.reviewer;
}

function receiptPath(runRoot, reviewer) {
  return path.join(runRoot, "reviews", "subagents", `${reviewer}.md`);
}

function parseVerdict(text) {
  return verdicts.find((verdict) => new RegExp(`\\b${verdict.replaceAll(" ", "\\s+")}\\b`, "i").test(text)) || "";
}

function countMustFix(text) {
  let inMustFix = false;
  let count = 0;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*#{1,6}\s*(?:\*\*)?`?MUST_FIX`?(?:\*\*)?\b/i.test(line)) {
      inMustFix = true;
      continue;
    }
    if (/^\s*#{1,6}\s+/.test(line)) inMustFix = false;
    const inline = line.match(/^\s*(?:(?:[-*]|\d+[.)])\s*)?(?:\*\*)?`?MUST_FIX`?(?:\*\*)?\s*[:|-]\s*(.+)$/i);
    const sectionItem = inMustFix ? line.match(/^\s*(?:[-*]|\d+[.)])\s+(.+)$/) : null;
    const finding = inline?.[1] || sectionItem?.[1] || "";
    if (finding && !/^(none|n\/a|no findings)\b/i.test(finding.trim())) count += 1;
  }
  return count;
}

async function readResult(runRoot, reviewer) {
  const file = receiptPath(runRoot, reviewer);
  if (!existsSync(file)) return { reviewer, status: "missing", receiptPath: path.relative(runRoot, file), verdict: "", mustFixCount: 0 };
  const body = await readFile(file, "utf8");
  return { reviewer, status: "complete", receiptPath: path.relative(runRoot, file), verdict: parseVerdict(body), mustFixCount: countMustFix(body) };
}

function markdown(payload) {
  const lines = [
    "# Subagent Reviewer Results",
    "",
    `- status: \`${payload.status}\``,
    `- selected_reviewers: \`${payload.selectedReviewers.join(",")}\``,
    `- unresolved_must_fix_count: \`${payload.unresolvedMustFixCount}\``,
    `- must_fix_disposition: \`${payload.mustFixDisposition || ""}\``,
    "",
    "## Receipts",
  ];
  for (const result of payload.results) lines.push(`- ${result.reviewer}: ${result.status}, ${result.verdict || "missing verdict"}, ${result.receiptPath}`);
  return `${lines.join("\n")}\n`;
}

async function main() {
  const parsed = parseArgv(process.argv.slice(2));
  if (parsed.help || parsed.h) printHelpAndExit(HELP, 0);
  const runRoot = resolveRepoPath(repoRoot, asString(parsed["run-root"], ""));
  if (!runRoot) throw new Error("--run-root is required");
  const handoff = await readJson(path.join(runRoot, "reviews", "subagent-handoff.json"));
  const selectedReviewers = (Array.isArray(handoff.reviewers) ? handoff.reviewers : []).map(reviewerName).filter(Boolean);
  const results = await Promise.all(selectedReviewers.map((reviewer) => readResult(runRoot, reviewer)));
  const unresolvedMustFixCount = results.reduce((sum, result) => sum + result.mustFixCount, 0);
  const missing = results.filter((result) => result.status !== "complete" || !result.verdict).map((result) => result.reviewer);
  const blockingVerdicts = results.filter((result) => result.verdict !== "READY FOR PR").map((result) => result.reviewer);
  const mustFixDisposition = asString(parsed["must-fix-disposition"], "");
  const status = missing.length === 0 && blockingVerdicts.length === 0 && validMustFixDisposition(mustFixDisposition, unresolvedMustFixCount) ? "pass" : "fail";
  const payload = { status, selectedReviewers, results, unresolvedMustFixCount, mustFixDisposition, missing, blockingVerdicts };
  const reviewDir = path.join(runRoot, "reviews");
  await mkdir(reviewDir, { recursive: true });
  await writeFile(path.join(reviewDir, "subagent-results.json"), `${JSON.stringify(payload, null, 2)}\n`);
  await writeFile(path.join(reviewDir, "subagent-results.md"), markdown(payload));
  printJson(payload);
  if (status !== "pass") process.exit(1);
}

main().catch((error) => {
  process.stderr.write(`[subagent-results] FAIL: ${error.stack || error.message}\n`);
  process.exit(1);
});
