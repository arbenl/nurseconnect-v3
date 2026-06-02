#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgv } from "./lib/cli.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const defaults = ["claude", "gemini", "copilot"];

const routes = {
  claude: {
    label: "Claude Sonnet architecture review",
    command: "claude",
    args: ["-p", "{prompt}", "--model", "claude-sonnet-4-6", "--tools", "", "--no-session-persistence"],
  },
  gemini: {
    label: "Gemini Pro product review",
    command: "gemini",
    args: ["-p", "{prompt}", "--model", "gemini-3.1-pro-preview", "--output-format", "text"],
  },
  copilot: {
    label: "Copilot Pro+ Sonnet fallback review",
    command: "copilot",
    args: ["--model", "claude-sonnet-4.6", "-p", "{prompt}", "--available-tools=", "--no-custom-instructions", "--no-color", "--silent"],
  },
};

const sensitivePatterns = [
  ["github-token", /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ["bearer-token", /Authorization:\s*Bearer\s+[A-Za-z0-9._-]+/i],
  ["database-url", /\bDATABASE_URL\s*=\s*\S+/i],
  ["auth-secret", /\b(BETTER_AUTH_SECRET|AUTH_SECRET)\s*=\s*\S+/i],
  ["possible-ssn", /\b\d{3}-\d{2}-\d{4}\b/],
  ["possible-mrn", /\b(?:MRN|medical\s*record\s*number)\s*[:=]\s*[A-Za-z0-9-]{6,}/i],
  ["possible-dob", /\b(?:DOB|date\s*of\s*birth)\s*[:=]\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/i],
];

function usage() {
  return `
Usage: pnpm model-review -- --packet <file> [options]

Options:
  --run-root <path>          Evidence root. Defaults to tmp/multi-agent/model-review/<timestamp>
  --reviewers <list>         Comma list: claude,gemini,copilot
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

function splitReviewers(value) {
  const selected = String(value || defaults.join(","))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  for (const reviewer of selected) {
    if (!routes[reviewer]) fail(`unknown reviewer route: ${reviewer}`);
  }
  return selected;
}

function sensitiveMatches(text) {
  return sensitivePatterns
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name);
}

function commandArgs(route, prompt) {
  return route.args.map((arg) => (arg === "{prompt}" ? prompt : arg));
}

function runRoute(name, prompt, options) {
  const route = routes[name];
  const args = commandArgs(route, prompt);
  if (options.dryRun) {
    return Promise.resolve({ reviewer: name, status: "dry-run", command: route.command, args, stdout: `[dry-run] ${route.label}`, stderr: "", exitCode: 0 });
  }
  return new Promise((resolve) => {
    const child = spawn(route.command, args, { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", (error) =>
      resolve({ reviewer: name, status: "blocked", command: route.command, args, stdout, stderr: error.message, exitCode: -1 })
    );
    child.on("close", (code) =>
      resolve({ reviewer: name, status: code === 0 ? "complete" : "blocked", command: route.command, args, stdout, stderr, exitCode: code ?? -1 })
    );
  });
}

function writeReceipt(reviewDir, result) {
  const safe = safeResult(result);
  writeFileSync(path.join(reviewDir, `${result.reviewer}.json`), `${JSON.stringify(safe, null, 2)}\n`);
  writeFileSync(
    path.join(reviewDir, `${result.reviewer}.md`),
    [`# ${result.reviewer} Review`, "", `- status: \`${result.status}\``, `- command: \`${result.command}\``, "", "## stdout", result.stdout || "", "", "## stderr", result.stderr || ""].join("\n"),
  );
}

function safeResult(result) {
  return { ...result, args: result.args.map((arg) => (arg.length > 240 ? `${arg.slice(0, 240)}...` : arg)) };
}

async function main() {
  const args = parseArgv(process.argv.slice(2));
  if (args.help || args.h) process.stdout.write(usage());
  if (args.help || args.h) return;
  const packetPath = resolveRepoPath(args.packet);
  if (!packetPath) fail("--packet is required");
  const packet = readFileSync(packetPath, "utf8");
  const matches = sensitiveMatches(packet);
  if (matches.length > 0 && !args["allow-sensitive"]) {
    fail(`packet matched sensitive patterns: ${matches.join(", ")}`);
  }
  const runRoot = resolveRepoPath(args["run-root"] || `tmp/multi-agent/model-review/${new Date().toISOString().replace(/[.:]/g, "-")}`);
  const reviewDir = path.join(runRoot, "reviews");
  mkdirSync(reviewDir, { recursive: true });
  const selected = splitReviewers(args.reviewers);
  const results = [];
  for (const reviewer of selected) {
    const result = await runRoute(reviewer, packet, { dryRun: Boolean(args["dry-run"]) });
    results.push(result);
    writeReceipt(reviewDir, result);
  }
  const manifest = { packetPath, runRoot, reviewers: selected, results: results.map(safeResult) };
  writeFileSync(path.join(reviewDir, "model-review-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`[model-review] run_root=${runRoot}\n[model-review] reviewers=${selected.join(" ")}\n`);
}

main().catch((error) => fail(error?.message || String(error)));
