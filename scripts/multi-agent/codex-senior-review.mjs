#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { asString, parseArgv, printHelpAndExit } from "./lib/cli.mjs";
import { validMustFixDisposition } from "./lib/slice-evidence-shared.mjs";
import { inspectSeniorResult, SENIOR_REVIEW_SCHEMA } from "./lib/senior-review-result.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const HELP = "Usage: node scripts/multi-agent/codex-senior-review.mjs --run-root <path> [--base origin/main] [--mode general|supabase]";

function git(args, label) {
  try {
    return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch (error) {
    throw new Error(`${label || args.join(" ")} failed: ${String(error.stderr || error.message).trim()}`);
  }
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
Report introduced regressions; label unchanged inherited debt separately and respect the owner-approved scope.
Prioritize concrete bugs and merge blockers. Use [P0] or [P1] only for issues that must be fixed before push.
Use the exact base_sha/head_sha above, inspect the local diff and directly affected code. Read-only: do not modify files or call external services. Return only the supplied JSON review schema; finding titles must start with their [P0]..[P3] priority.
Respect NurseConnect constraints: no PHI disclosure, no clinical/auth/schema/product behavior changes unless explicit.
${extra}`;
}

function runCodex({ base, packetPath, schemaPath, finalPath, firstOutputTimeoutMs, totalTimeoutMs }) {
  return new Promise((resolve) => {
    const args = ["exec", "--json", "--ephemeral", "--sandbox", "read-only", "--output-schema", schemaPath, "--output-last-message", finalPath, "-"];
    const child = spawn("codex", args, { cwd: repoRoot, detached: true, env: { ...process.env, CODEX_SENIOR_REVIEW_PACKET: packetPath } });
    child.unref();
    child.stdin.on("error", (error) => { killGroup(); finish({ stdout, stderr: `${stderr}\nstdin delivery failed: ${error.code || "pipe_error"}`, status: 1, signal: null, timedOut: "" }); });
    child.stdin.end(readFileSync(packetPath, "utf8"));
    let stdout = "";
    let stderr = "";
    let sawOutput = false;
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearTimeout(totalTimer);
      resolve({ ...result, args });
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
  const quote = (value) => "'" + value.replace(/'/g, "'\\''") + "'";
  const reviewsDir = path.join(runRoot, "reviews");
  mkdirSync(reviewsDir, { recursive: true });
  const markdownPath = path.join(reviewsDir, "codex-senior-review.md");
  const jsonPath = path.join(reviewsDir, "codex-senior-review.json");
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  const { blocker, mustFixCount, review, runtimeComplete } = inspectSeniorResult(result);
  const correctnessAccepted = review?.overall_correctness === "patch is correct" || /^rejected\s*:/.test(String(mustFixDisposition || "").trim().toLowerCase());
  const status = blocker ? "blocked" : correctnessAccepted && validMustFixDisposition(mustFixDisposition, mustFixCount) ? "pass" : "fail";
  writeFileSync(markdownPath, `# Codex Senior Review\n\n\`\`\`text\n${output || "(no output)"}\n\`\`\`\n`);
  writeFileSync(jsonPath, `${JSON.stringify({
    status,
    receiptVersion: 2, protocol: "codex-exec-jsonl-schema",
    reviewer: "codex-senior",
    command: `CODEX_SENIOR_REVIEW_PACKET=${quote(packetPath)} ${["codex", ...result.args].map(quote).join(" ")} < ${quote(packetPath)}`,
    invocation: { argv: ["codex", ...result.args], cwd: repoRoot, stdinPath: packetPath, environment: { CODEX_SENIOR_REVIEW_PACKET: packetPath } },
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
    runtimeComplete, review,
    findingBasis: "Schema-valid final result matched to runtime agent-message and turn.completed; diagnostics retained",
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
  const schemaPath = path.join(reviewsDir, "codex-senior-review-schema.json"), finalPath = path.join(reviewsDir, "codex-senior-review-final.json");
  writeFileSync(schemaPath, JSON.stringify(SENIOR_REVIEW_SCHEMA)); rmSync(finalPath, { force: true });
  const firstOutputTimeoutMs = Number(asString(parsed["first-output-timeout-ms"], process.env.CODEX_SENIOR_FIRST_OUTPUT_TIMEOUT_MS || "120000"));
  const totalTimeoutMs = Number(asString(parsed["total-timeout-ms"], process.env.CODEX_SENIOR_TOTAL_TIMEOUT_MS || "900000"));
  const result = await runCodex({ base, packetPath, schemaPath, finalPath, firstOutputTimeoutMs, totalTimeoutMs });
  result.finalMessage = existsSync(finalPath) ? readFileSync(finalPath, "utf8") : "";
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
