#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgv } from "./lib/cli.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const defaults = ["codex", "claude", "gemini", "copilot"];

const routes = {
  codex: {
    label: "Codex implementation critique",
    command: "codex",
    args: ["exec", "--model", process.env.CODEX_REVIEW_MODEL || "gpt-5.5", "{prompt}"],
  },
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
    label: "Copilot Pro+ Sonnet 4.6 review",
    command: "copilot",
    args: [
      "--model",
      "claude-sonnet-4.6",
      "--effort",
      "low",
      "-p",
      "{prompt}",
      "--available-tools=",
      "--no-custom-instructions",
      "--no-color",
      "--silent",
      "--no-remote",
      "--no-ask-user",
      "--output-format",
      "text",
      "--stream",
      "off",
    ],
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

const defaultTimeoutMs = 120_000;

function usage() {
  return `
Usage: pnpm model-review -- --packet <file> [options]

Options:
  --run-root <path>          Evidence root. Defaults to tmp/multi-agent/model-review/<timestamp>
  --reviewers <list>         Comma list: codex,claude,gemini,copilot
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

function reviewerPrompt(packet) {
  return [
    "Review this NurseConnect slice design. Return concise findings grouped as MUST_FIX, SHOULD_FIX, NICE_TO_HAVE, and APPROVED_NOTES.",
    "Focus on architecture, auth/tenant/PHI safety, testability, rollback, and PR readiness. Do not request secrets or PHI.",
    "",
    packet,
  ].join("\n");
}

function debatePrompt(packet, selected) {
  return [
    "You are one participant in a NurseConnect slice critique debate.",
    `Other requested reviewers: ${selected.join(", ")}.`,
    "Challenge assumptions, identify the strongest MUST_FIX risk, and name any finding you would reject with rationale.",
    "Do not request or expose secrets, PHI, patient details, or raw production data.",
    "",
    packet,
  ].join("\n");
}

function timeoutMs() {
  const parsed = Number(process.env.MODEL_REVIEW_TIMEOUT_MS || defaultTimeoutMs);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultTimeoutMs;
}

function runRoute(name, prompt, options) {
  const route = routes[name];
  const args = commandArgs(route, reviewerPrompt(prompt));
  if (options.dryRun) {
    return Promise.resolve({ reviewer: name, status: "dry-run", command: route.command, args, stdout: `[dry-run] ${route.label}`, stderr: "", exitCode: 0 });
  }
  return new Promise((resolve) => {
    const child = spawn(route.command, args, { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      resolve({
        reviewer: name,
        status: "blocked",
        command: route.command,
        args,
        stdout,
        stderr: `${stderr}\nTimed out after ${timeoutMs()}ms`.trim(),
        exitCode: -1,
      });
    }, timeoutMs());
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ reviewer: name, status: "blocked", command: route.command, args, stdout, stderr: error.message, exitCode: -1 });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ reviewer: name, status: code === 0 ? "complete" : "blocked", command: route.command, args, stdout, stderr, exitCode: code ?? -1 });
    });
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

function findingLines(text, label) {
  const lines = String(text || "").split("\n");
  const findings = [];
  for (const line of lines) {
    if (/\b(MUST_FIX|SHOULD_FIX|NICE_TO_HAVE|HARDENING|OPTIONAL)\b/i.test(line)) {
      findings.push(`${label}: ${line.trim()}`);
    }
  }
  return findings.slice(0, 20);
}

function writeDebate(reviewDir, results) {
  const completed = results.filter((result) => result.status === "complete" || result.status === "dry-run");
  const blocked = results.filter((result) => result.status === "blocked");
  const mustFix = results.flatMap((result) => findingLines(result.stdout, result.reviewer).filter((line) => /MUST_FIX/i.test(line)));
  const otherFindings = results.flatMap((result) => findingLines(result.stdout, result.reviewer).filter((line) => !/MUST_FIX/i.test(line)));
  const verdict = mustFix.length > 0 ? "NOT READY UNTIL MUST_FIX DISPOSITION" : "READY IF DETERMINISTIC GATES PASS";
  const debate = {
    generatedAt: new Date().toISOString(),
    participants: results.map((result) => ({ reviewer: result.reviewer, status: result.status, exitCode: result.exitCode })),
    completed: completed.map((result) => result.reviewer),
    blocked: blocked.map((result) => ({ reviewer: result.reviewer, stderr: result.stderr.slice(0, 500) })),
    agreedMustFixCandidates: mustFix,
    otherFindingCandidates: otherFindings,
    disputedOrMissingEvidence: blocked.map((result) => `${result.reviewer} unavailable; treat as missing advisory signal, not approval.`),
    verdict,
  };

  writeFileSync(path.join(reviewDir, "debate.json"), `${JSON.stringify(debate, null, 2)}\n`);
  writeFileSync(
    path.join(reviewDir, "debate.md"),
    [
      "# Model Critique Debate",
      "",
      `- verdict: \`${verdict}\``,
      `- completed: \`${debate.completed.join(", ") || "none"}\``,
      `- blocked: \`${debate.blocked.map((item) => item.reviewer).join(", ") || "none"}\``,
      "",
      "## Agreed MUST_FIX Candidates",
      ...(mustFix.length > 0 ? mustFix.map((item) => `- ${item}`) : ["- None detected in reviewer output."]),
      "",
      "## Other Finding Candidates",
      ...(otherFindings.length > 0 ? otherFindings.map((item) => `- ${item}`) : ["- None detected in reviewer output."]),
      "",
      "## Missing Or Disputed Evidence",
      ...(debate.disputedOrMissingEvidence.length > 0 ? debate.disputedOrMissingEvidence.map((item) => `- ${item}`) : ["- None."]),
    ].join("\n"),
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
  const prompt = args.debate ? debatePrompt(packet, selected) : packet;
  const results = [];
  for (const reviewer of selected) {
    const result = await runRoute(reviewer, prompt, { dryRun: Boolean(args["dry-run"]) });
    results.push(result);
    writeReceipt(reviewDir, result);
  }
  if (args.debate) {
    writeDebate(reviewDir, results);
  }
  const manifest = { packetPath, runRoot, reviewers: selected, debate: Boolean(args.debate), results: results.map(safeResult) };
  writeFileSync(path.join(reviewDir, "model-review-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`[model-review] run_root=${runRoot}\n[model-review] reviewers=${selected.join(" ")}\n`);
  if (args.debate) process.stdout.write(`[model-review] debate=${path.join(reviewDir, "debate.md")}\n`);
}

main().catch((error) => fail(error?.message || String(error)));
