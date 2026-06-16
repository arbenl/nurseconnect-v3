import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

import { commandArgs, routes } from "./model-review-routes.mjs";
import { reviewerPrompt } from "./model-review-prompts.mjs";

function timeoutMs(env = process.env) {
  const parsed = Number(env.MODEL_REVIEW_TIMEOUT_MS || 120_000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 120_000;
}

export function safeResult(result) {
  return { ...result, args: result.args.map((arg) => (arg.length > 240 ? `${arg.slice(0, 240)}...` : arg)) };
}

function blockerReason({ stdout, stderr, exitCode, timedOut }) {
  const text = `${stdout || ""}\n${stderr || ""}`.toLowerCase();
  if (text.includes("quota") || text.includes("rate limit") || text.includes("rate_limit")) return "quota_or_rate_limit";
  if (text.includes("auth") || text.includes("oauth") || text.includes("login") || text.includes("unauthorized")) return "auth_required";
  if (text.includes("model") && (text.includes("not found") || text.includes("unavailable") || text.includes("unknown"))) return "model_unavailable";
  if (timedOut || text.includes("timed out") || (exitCode === 0 && text.trim() === "")) return "timeout_or_no_output";
  if (exitCode !== 0) return "route_exit_nonzero";
  return null;
}

function killProcessGroup(child) {
  if (!child.pid) return false;
  try {
    process.kill(-child.pid, "SIGKILL");
    return true;
  } catch {
    return child.kill("SIGKILL");
  }
}

export function runRoute(name, prompt, options, repoRoot) {
  const route = routes[name];
  const args = commandArgs(route, options.rawPrompt ? prompt : reviewerPrompt(prompt));
  const env = options.env ? { ...process.env, ...options.env } : process.env;
  const limitMs = timeoutMs(env);
  if (options.dryRun) {
    return Promise.resolve({
      reviewer: name,
      status: "dry-run",
      label: route.label,
      provider: route.provider,
      model: route.model,
      role: route.role,
      command: route.command,
      args,
      stdout: `[dry-run] ${route.label}`,
      stderr: "",
      exitCode: 0,
    });
  }
  return new Promise((resolve) => {
    const child = spawn(route.command, args, {
      cwd: repoRoot,
      detached: process.platform !== "win32",
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timeoutResult = null;
    let settleTimer = null;
    const done = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(settleTimer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      const suffix = `Timed out after ${limitMs}ms; killed reviewer process group`;
      timeoutResult = makeResult(name, route, args, stdout, `${stderr}\n${suffix}`.trim(), -1, { timedOut: true });
      killProcessGroup(child);
      settleTimer = setTimeout(() => done(timeoutResult), 1_000);
    }, limitMs);
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", (error) => done(makeResult(name, route, args, stdout, error.message, -1)));
    child.on("close", (code) => done(timeoutResult ?? makeResult(name, route, args, stdout, stderr, code ?? -1)));
  });
}

function makeResult(name, route, args, stdout, stderr, exitCode, options = {}) {
  const hasOutput = `${stdout || ""}${stderr || ""}`.trim().length > 0;
  const status = exitCode === 0 && hasOutput ? "complete" : "blocked";
  return {
    reviewer: name,
    status,
    blockerReason: status === "blocked" ? blockerReason({ stdout, stderr, exitCode, timedOut: options.timedOut }) : null,
    label: route.label,
    provider: route.provider,
    model: route.model,
    role: route.role,
    overrideEnv: route.overrideEnv,
    command: route.command,
    args,
    stdout,
    stderr,
    exitCode,
  };
}

export function writeReceipt(reviewDir, result) {
  writeFileSync(path.join(reviewDir, `${result.reviewer}.json`), `${JSON.stringify(safeResult(result), null, 2)}\n`);
  writeFileSync(
    path.join(reviewDir, `${result.reviewer}.md`),
    [
      `# ${result.reviewer} Review`,
      "",
      `- status: \`${result.status}\``,
      result.blockerReason ? `- blocker_reason: \`${result.blockerReason}\`` : null,
      `- label: \`${result.label || result.reviewer}\``,
      `- provider: \`${result.provider || "unknown"}\``,
      `- model: \`${result.model || "unknown"}\``,
      `- role: \`${result.role || "unknown"}\``,
      `- command: \`${result.command}\``,
      "",
      "## stdout",
      result.stdout || "",
      "",
      "## stderr",
      result.stderr || "",
    ].filter((line) => line !== null && line !== undefined).join("\n"),
  );
}
