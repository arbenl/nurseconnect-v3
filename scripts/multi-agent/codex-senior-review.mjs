#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { asString, parseArgv, printHelpAndExit } from "./lib/cli.mjs";
import { validMustFixDisposition } from "./lib/slice-evidence-shared.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const HELP = "Usage: node scripts/multi-agent/codex-senior-review.mjs --run-root <path> [--base origin/main] [--mode general|supabase]";

function git(args, label) {
  try {
    return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch (error) {
    throw new Error(`${label || args.join(" ")} failed: ${String(error.stderr || error.message).trim()}`);
  }
}

function countMustFix(text) {
  const matches = String(text || "").match(/\[(?:P0|P1)\]|\bMUST_FIX\b/gi);
  return matches ? matches.length : 0;
}

function packetBody({ base, baseSha, headSha, changedFiles, mode }) {
  const extra = mode === "supabase"
    ? "Extra focus: Supabase schema, RLS, auth-provider, migration, tenant isolation, and database access regressions."
    : "Extra focus: workflow-gate, parser, finalizer, evidence, CI, and reviewer-route regressions.";
  return `# NurseConnect Codex Senior Review Packet

- reviewer: codex-senior
- mode: ${mode}
- base: ${base}
- base_sha: ${baseSha}
- head_sha: ${headSha}
- changed_files: ${changedFiles.join(", ") || "none"}

Review the entire PR slice diff for correctness, security, test gaps, and maturity regressions.
Prioritize concrete bugs and merge blockers. Use [P0] or [P1] only for issues that must be fixed before push.
Respect NurseConnect constraints: no PHI disclosure, no clinical/auth/schema/product behavior changes unless explicit.
${extra}`;
}

function classifyBlocker({ output, code, signal, timedOut }) {
  const text = String(output || "").toLowerCase();
  if (timedOut === "first_output") return "no_output_timeout";
  if (timedOut === "total") return "total_timeout";
  if (/quota|rate limit|too many requests|429/.test(text)) return "quota_or_rate_limit";
  if (/auth|unauthorized|forbidden|login|api key|token/.test(text)) return "auth";
  if (code !== 0 || signal) return "command_failed";
  return "";
}

function runCodex({ base, packetPath, firstOutputTimeoutMs, totalTimeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn("codex", ["review", "--base", base], { cwd: repoRoot, detached: true, env: { ...process.env, CODEX_SENIOR_REVIEW_PACKET: packetPath } });
    child.unref();
    let stdout = "";
    let stderr = "";
    let sawOutput = false;
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearTimeout(totalTimer);
      resolve(result);
    };
    const killGroup = () => { try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); } };
    const timer = setTimeout(() => {
      if (!sawOutput) { killGroup(); child.stdout.destroy(); child.stderr.destroy(); finish({ stdout, stderr, status: 124, signal: "SIGTERM", timedOut: "first_output" }); }
    }, firstOutputTimeoutMs);
    const totalTimer = setTimeout(() => {
      killGroup(); child.stdout.destroy(); child.stderr.destroy(); finish({ stdout, stderr, status: 124, signal: "SIGTERM", timedOut: "total" });
    }, totalTimeoutMs);
    child.stdout.on("data", (chunk) => { sawOutput = true; stdout += chunk; });
    child.stderr.on("data", (chunk) => { sawOutput = true; stderr += chunk; });
    child.on("error", (error) => finish({ stdout, stderr: `${stderr}${error.message}`, status: 127, signal: null, timedOut: "" }));
    child.on("close", (code, signal) => finish({ stdout, stderr, status: code ?? 1, signal, timedOut: "" }));
  });
}

function writeReceipt({ runRoot, base, baseSha, headSha, changedFiles, packetPath, result, mustFixDisposition }) {
  const reviewsDir = path.join(runRoot, "reviews");
  mkdirSync(reviewsDir, { recursive: true });
  const markdownPath = path.join(reviewsDir, "codex-senior-review.md");
  const jsonPath = path.join(reviewsDir, "codex-senior-review.json");
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  const mustFixCount = countMustFix(output);
  const blocker = classifyBlocker({ output, code: result.status, signal: result.signal, timedOut: result.timedOut });
  const status = blocker ? "blocked" : validMustFixDisposition(mustFixDisposition, mustFixCount) ? "pass" : "fail";
  writeFileSync(markdownPath, `# Codex Senior Review\n\n\`\`\`text\n${output || "(no output)"}\n\`\`\`\n`);
  writeFileSync(jsonPath, `${JSON.stringify({
    status,
    reviewer: "codex-senior",
    command: `CODEX_SENIOR_REVIEW_PACKET=${path.relative(runRoot, packetPath)} codex review --base ${base}`,
    packetPath: path.relative(runRoot, packetPath),
    base,
    baseSha,
    headSha,
    changedFiles,
    exitCode: result.status,
    signal: result.signal || null,
    blocker: blocker || null,
    receiptPath: "reviews/codex-senior-review.md",
    mustFixCount,
    mustFixDisposition: mustFixDisposition || (mustFixCount === 0 ? "none" : ""),
  }, null, 2)}\n`);
  return { status, jsonPath, markdownPath, mustFixCount };
}

async function main() {
  const parsed = parseArgv(process.argv.slice(2));
  if (parsed.help || parsed.h) printHelpAndExit(HELP, 0);
  const runRootArg = asString(parsed["run-root"], "");
  if (!runRootArg) printHelpAndExit(HELP, 1);
  const runRoot = path.isAbsolute(runRootArg) ? runRootArg : path.join(repoRoot, runRootArg);
  const base = asString(parsed.base, "origin/main");
  const mode = asString(parsed.mode, "general");
  const baseSha = git(["rev-parse", base], "base ref resolution");
  const headSha = git(["rev-parse", "HEAD"], "HEAD resolution");
  const changedFiles = git(["diff", "--name-only", `${base}...HEAD`], "protected diff resolution").split(/\r?\n/).filter(Boolean);
  const reviewsDir = path.join(runRoot, "reviews");
  mkdirSync(reviewsDir, { recursive: true });
  const packetPath = path.join(reviewsDir, "codex-senior-review-packet.md");
  writeFileSync(packetPath, `${packetBody({ base, baseSha, headSha, changedFiles, mode })}\n`);
  const firstOutputTimeoutMs = Number(asString(parsed["first-output-timeout-ms"], process.env.CODEX_SENIOR_FIRST_OUTPUT_TIMEOUT_MS || "120000"));
  const totalTimeoutMs = Number(asString(parsed["total-timeout-ms"], process.env.CODEX_SENIOR_TOTAL_TIMEOUT_MS || "900000"));
  const result = await runCodex({ base, packetPath, firstOutputTimeoutMs, totalTimeoutMs });
  const receipt = writeReceipt({
    runRoot,
    base,
    baseSha,
    headSha,
    changedFiles,
    packetPath,
    result,
    mustFixDisposition: asString(parsed["must-fix-disposition"], ""),
  });
  console.log(`[codex-senior-review] ${receipt.status} ${receipt.jsonPath}`);
  process.exitCode = receipt.status === "pass" ? 0 : 1;
}

main().catch((error) => {
  console.error(`[codex-senior-review] fail ${error.message}`);
  process.exitCode = 1;
});
