import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { runRoute, safeResult } from "./model-review-runner.mjs";
import { routes } from "./model-review-routes.mjs";

function inlineText(value, limit = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function remediation(result) {
  if (!result.overrideEnv) return null;
  return {
    overrideEnv: result.overrideEnv,
    currentModel: result.model,
    instruction: `Set ${result.overrideEnv} to a callable model id, then rerun model-review --access-check.`,
  };
}

function preflightRoute(name, repoRoot) {
  const route = routes[name];
  const result = spawnSync(route.command, ["--version"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 5_000,
  });
  const base = {
    reviewer: name,
    label: route.label,
    provider: route.provider,
    model: route.model,
    role: route.role,
    command: route.command,
    checkArgs: ["--version"],
    stdout: String(result.stdout || "").trim(),
    stderr: String(result.stderr || "").trim(),
  };
  if (result.error) return { ...base, status: "blocked", blocker: result.error.message, exitCode: -1 };
  if (result.status !== 0) return { ...base, status: "blocked", blocker: `version check exited ${result.status}`, exitCode: result.status ?? -1 };
  return { ...base, status: "available", version: base.stdout || base.stderr || "available", exitCode: result.status };
}

export function writePreflight(runRoot, selected, repoRoot) {
  const reviewDir = path.join(runRoot, "reviews");
  mkdirSync(reviewDir, { recursive: true });
  const results = selected.map((reviewer) => preflightRoute(reviewer, repoRoot));
  const blocked = results.filter((result) => result.status === "blocked");
  const payload = { generatedAt: new Date().toISOString(), runRoot, status: blocked.length > 0 ? "blocked" : "pass", reviewers: selected, results };
  const jsonPath = path.join(reviewDir, "model-review-preflight.json");
  const mdPath = path.join(reviewDir, "model-review-preflight.md");
  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(mdPath, preflightMarkdown(payload, jsonPath));
  process.stdout.write(`[model-review] preflight=${payload.status}\n[model-review] evidence=${mdPath}\n`);
  if (blocked.length > 0) process.exit(1);
}

function preflightMarkdown(payload, jsonPath) {
  const blocked = payload.results.filter((result) => result.status === "blocked");
  return [
    "# Model Review Route Preflight",
    "",
    `- status: \`${payload.status}\``,
    `- reviewers: \`${payload.reviewers.join(", ") || "none"}\``,
    `- blocked: \`${blocked.map((result) => result.reviewer).join(", ") || "none"}\``,
    "- auth_scope: `version check only; live review receipts prove model access, auth, and quota`",
    "",
    "## Routes",
    ...payload.results.flatMap((result) => [
      "",
      `### ${result.reviewer}`,
      `- status: \`${result.status}\``,
      `- label: \`${result.label}\``,
      `- provider: \`${result.provider}\``,
      `- model: \`${result.model}\``,
      `- command: \`${result.command} --version\``,
      result.version ? `- version: \`${inlineText(result.version)}\`` : null,
      result.blocker ? `- blocker: \`${inlineText(result.blocker)}\`` : null,
    ].filter(Boolean)),
    "",
    "## Files",
    "",
    `- Raw JSON: \`${jsonPath}\``,
  ].join("\n");
}

export async function writeAccessCheck(runRoot, selected, repoRoot) {
  const reviewDir = path.join(runRoot, "reviews");
  mkdirSync(reviewDir, { recursive: true });
  const prompt = [
    "NurseConnect model route access check.",
    "Return exactly MODEL_ROUTE_OK and no other text.",
    "This prompt contains no PHI, secrets, production data, patient details, or clinical details.",
  ].join("\n");
  const results = [];
  for (const reviewer of selected) results.push(await runRoute(reviewer, prompt, { dryRun: false, rawPrompt: true }, repoRoot));
  const blocked = results.filter((result) => result.status === "blocked");
  const completed = results.filter((result) => result.status === "complete").map((result) => result.reviewer);
  const payload = {
    generatedAt: new Date().toISOString(),
    runRoot,
    status: blocked.length > 0 ? "blocked" : "pass",
    reviewers: selected,
    completed,
    blocked: blocked.map((result) => ({
      reviewer: result.reviewer,
      provider: result.provider,
      model: result.model,
      blocker: (result.stderr || result.stdout).slice(0, 500),
      remediation: remediation(result),
    })),
    results: results.map(safeResult),
  };
  const jsonPath = path.join(reviewDir, "model-review-access.json");
  const mdPath = path.join(reviewDir, "model-review-access.md");
  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(mdPath, accessMarkdown(payload, results, jsonPath));
  process.stdout.write(`[model-review] access_check=${payload.status}\n[model-review] evidence=${mdPath}\n`);
  if (blocked.length > 0) process.exit(1);
}

function accessMarkdown(payload, results, jsonPath) {
  return [
    "# Model Review Access Check",
    "",
    `- status: \`${payload.status}\``,
    `- completed: \`${payload.completed.join(", ") || "none"}\``,
    `- blocked: \`${payload.blocked.map((result) => result.reviewer).join(", ") || "none"}\``,
    "- prompt_scope: `minimal non-sensitive access probe`",
    "",
    "## Remediation",
    ...(payload.blocked.length > 0
      ? payload.blocked.map((item) => `- ${item.reviewer}: ${item.remediation?.instruction || "fix route command/auth/quota, then rerun access-check."}`)
      : ["- None."]),
    "",
    "## Routes",
    ...results.flatMap((result) => ["", `### ${result.reviewer}`, `- status: \`${result.status}\``, `- provider: \`${result.provider}\``, `- model: \`${result.model}\``, result.stdout ? `- stdout: \`${inlineText(result.stdout)}\`` : null, result.stderr ? `- stderr: \`${inlineText(result.stderr)}\`` : null].filter(Boolean)),
    "",
    "## Files",
    "",
    `- Raw JSON: \`${jsonPath}\``,
  ].join("\n");
}
