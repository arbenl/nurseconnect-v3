#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgv } from "./lib/cli.mjs";
import { writeDebate } from "./lib/model-review-debate.mjs";
import { writeAccessCheck, writePreflight } from "./lib/model-review-route-checks.mjs";
import { runRoute, safeResult, writeReceipt } from "./lib/model-review-runner.mjs";
import { splitReviewers } from "./lib/model-review-routes.mjs";
import { debatePrompt, sensitiveMatches } from "./lib/model-review-prompts.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

function usage() {
  return `
Usage: pnpm model-review -- --packet <file> [options]
       pnpm model-review -- --preflight [options]
       pnpm model-review -- --access-check [options]

Options:
  --run-root <path>          Evidence root. Defaults to tmp/multi-agent/model-review/<timestamp>
  --reviewers <list>         Comma list: claude48,claude47,sonnet46,claude,gemini,copilot,codex
  --preflight                Check selected reviewer CLI routes and write route-readiness evidence
  --access-check             Call selected reviewer routes with a minimal non-sensitive prompt
  --debate                   Write a critique debate synthesis from reviewer receipts
  --dry-run                  Write receipts without calling model CLIs
  --allow-sensitive          Allow packet despite PHI/secret pattern matches
`;
}

function fail(message) {
  process.stderr.write(`[model-review] FAIL: ${message}\n`);
  process.exit(1);
}

function resolveRepoPath(value) {
  if (!value) return "";
  return path.isAbsolute(value) ? value : path.join(repoRoot, value);
}

async function runReview({ args, runRoot, reviewDir, selected }) {
  const packetPath = resolveRepoPath(args.packet);
  if (!packetPath) fail("--packet is required");
  const packet = readFileSync(packetPath, "utf8");
  const matches = sensitiveMatches(packet);
  if (matches.length > 0 && !args["allow-sensitive"]) fail(`packet matched sensitive patterns: ${matches.join(", ")}`);
  const prompt = args.debate ? debatePrompt(packet, selected) : packet;
  const results = [];
  for (const reviewer of selected) {
    const result = await runRoute(reviewer, prompt, { dryRun: Boolean(args["dry-run"]) }, repoRoot);
    results.push(result);
    writeReceipt(reviewDir, result);
  }
  if (args.debate) writeDebate(reviewDir, results);
  const manifest = { packetPath, runRoot, reviewers: selected, debate: Boolean(args.debate), results: results.map(safeResult) };
  writeFileSync(path.join(reviewDir, "model-review-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`[model-review] run_root=${runRoot}\n[model-review] reviewers=${selected.join(" ")}\n`);
  if (args.debate) process.stdout.write(`[model-review] debate=${path.join(reviewDir, "debate.md")}\n`);
}

async function main() {
  const args = parseArgv(process.argv.slice(2));
  if (args.help || args.h) {
    process.stdout.write(usage());
    return;
  }
  const runRoot = resolveRepoPath(args["run-root"] || `tmp/multi-agent/model-review/${new Date().toISOString().replace(/[.:]/g, "-")}`);
  const reviewDir = path.join(runRoot, "reviews");
  mkdirSync(reviewDir, { recursive: true });
  const selected = splitReviewers(args.reviewers, fail);
  if (args.preflight) return writePreflight(runRoot, selected, repoRoot);
  if (args["access-check"]) return await writeAccessCheck(runRoot, selected, repoRoot);
  await runReview({ args, runRoot, reviewDir, selected });
}

main().catch((error) => fail(error?.message || String(error)));
