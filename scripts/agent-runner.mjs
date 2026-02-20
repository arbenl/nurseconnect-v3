#!/usr/bin/env node
/**
 * Usage:
 *   node scripts/agent-runner.mjs <agent> <task>
 * Example:
 *   node scripts/agent-runner.mjs dev 1-auth-roles
 *
 * Agents: dev | qa | security | ops | ux | perf
 * Prompts expected at: prompts/{context_*.md, <task>.md} (or specialized variants)
 * Output to: output/<task>/<AGENT>.plan.json
 */

// top of file (ensure ESM imports, not require)
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// workspace root is parent of this scripts folder
const root = join(__dirname, "..");
const STEER_CONFIG_PATH = join(root, "steer", "steer.config.json");
const AGENT = process.argv[2];
const TASK = process.argv[3];
const AGENT_RISK = (process.env.RISK || "low").toLowerCase();
const LOCAL_AGENT_RUNNER = process.env.STEER_LOCAL === "1" || process.env.STEER_LOCAL === "true";

const DEFAULT_POLICY = {
  maxActionsPerAgent: 40,
  allowedActions: ["write", "append", "replace"],
  allowedPathPrefixes: [
    "apps",
    "packages",
    "scripts",
    "prompts",
    "schemas",
    "schema",
    "docs",
    "infra",
    "config",
    ".github",
    "tools",
  ],
  blockedPathFragments: [
    ".git/",
    "node_modules/",
    "dist/",
    "coverage/",
    ".next/",
    "artifacts/",
    "build/",
    "tmp/",
    "temp/",
  ],
  blockedFileNameFragments: [".pem", ".key", ".pfx"],
  rootAllowedFiles: [
    "package.json",
    "pnpm-lock.yaml",
    "tsconfig.json",
    "turbo.json",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
    "pnpm-workspace.yaml",
    "vitest.config.ts",
  ],
  allowedExtensions: [
    ".ts",
    ".tsx",
    ".js",
    ".mjs",
    ".cjs",
    ".json",
    ".md",
    ".css",
    ".sql",
    ".yml",
    ".yaml",
    ".toml",
    ".prisma",
  ],
};

if (!AGENT || !TASK) {
  console.error("Usage: node scripts/agent-runner.mjs <agent> <task>");
  process.exit(1);
}

const AGENT_MAP = {
  dev: { context: "context_dev.md", out: "DEV.plan.json" },
  qa: { context: "context_qa.md", out: "QA.plan.json" },
  security: { context: "context_security.md", out: "SECURITY.plan.json" },
  ops: { context: "context_devops.md", out: "OPS.plan.json" },
  ux: { context: "context_ux.md", out: "UX.plan.json" },
  perf: { context: "context_perf.md", out: "PERF.plan.json" },
  critic: { context: "context_qa.md", out: "CRITIC.plan.json" },
  reconciler: { context: "context_devops.md", out: "RECONCILER.plan.json" },
};

if (!AGENT_MAP[AGENT]) {
  console.error(`Unknown agent: ${AGENT}. Use one of: ${Object.keys(AGENT_MAP).join(" | ")}`);
  process.exit(1);
}

function readJson(filePath) {
  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function loadPolicy() {
  try {
    if (!existsSync(STEER_CONFIG_PATH)) {
      return { governance: {} };
    }
    return readJson(STEER_CONFIG_PATH);
  } catch {
    return { governance: {} };
  }
}

const STEER_CONFIG = loadPolicy();

function preferValue(base, ...candidates) {
  for (const value of candidates) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return base;
}

function preferArray(base, ...candidates) {
  const replacement = candidates.find((value) => Array.isArray(value) && value.length > 0);
  return replacement || base || [];
}

function getPolicyForAgent(agentId, risk) {
  const runPolicy = STEER_CONFIG?.governance?.runPolicy || {};
  const defaultPolicy = runPolicy.defaultRiskPolicies || DEFAULT_POLICY;
  const riskPolicy = runPolicy.byRisk?.[risk] || {};
  const agentPolicy = runPolicy.agentPolicyById?.[agentId] || {};

  return {
    maxActionsPerAgent: preferValue(
      DEFAULT_POLICY.maxActionsPerAgent,
      preferValue(riskPolicy.maxActionsPerAgent, agentPolicy.maxActionsPerAgent)
    ),
    allowedActions: preferArray(
      DEFAULT_POLICY.allowedActions,
      riskPolicy.allowedActions,
      agentPolicy.allowedActions
    ),
    allowedPathPrefixes: preferArray(
      DEFAULT_POLICY.allowedPathPrefixes,
      riskPolicy.allowedPathPrefixes,
      agentPolicy.allowedPathPrefixes
    ),
    blockedPathFragments: preferArray(
      DEFAULT_POLICY.blockedPathFragments,
      riskPolicy.blockedPathFragments,
      agentPolicy.blockedPathFragments
    ),
    blockedFileNameFragments: preferArray(
      DEFAULT_POLICY.blockedFileNameFragments,
      riskPolicy.blockedFileNameFragments,
      agentPolicy.blockedFileNameFragments
    ),
    rootAllowedFiles: preferArray(
      DEFAULT_POLICY.rootAllowedFiles,
      riskPolicy.rootAllowedFiles,
      agentPolicy.rootAllowedFiles
    ),
    allowedExtensions: preferArray(
      DEFAULT_POLICY.allowedExtensions,
      riskPolicy.allowedExtensions,
      agentPolicy.allowedExtensions
    ),
  };
}

function normalizeActionType(inputType) {
  return String(inputType || "").trim().toLowerCase();
}

function normalizePath(inputPath) {
  return String(inputPath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/{2,}/g, "/");
}

function hasTraversal(cleanPath) {
  const parts = cleanPath.split("/");
  return parts.includes("..");
}

function isAbsoluteLike(rawPath) {
  return rawPath.startsWith("/") || /^[a-zA-Z]:\//.test(rawPath);
}

function isPathAllowed(rawPath, policy) {
  const cleanPath = normalizePath(rawPath);

  if (!cleanPath) {
    return false;
  }
  if (isAbsoluteLike(cleanPath) || hasTraversal(cleanPath)) {
    return false;
  }
  if (policy.blockedPathFragments.some((fragment) => cleanPath.includes(fragment))) {
    return false;
  }

  const lastSegment = cleanPath.split("/").at(-1) || "";
  if (policy.blockedFileNameFragments.some((fragment) => lastSegment.includes(fragment))) {
    return false;
  }

  const normalizedRoot = cleanPath.replace(/\/$/, "");
  if (policy.rootAllowedFiles.includes(normalizedRoot)) {
    return true;
  }

  const allowedPrefix = policy.allowedPathPrefixes.some((prefix) => {
    const normalizedPrefix = normalizePath(prefix).replace(/\/$/, "");
    if (!normalizedPrefix) return false;
    if (normalizedPrefix === ".") {
      return !cleanPath.includes("/");
    }
    return normalizedRoot === normalizedPrefix || normalizedRoot.startsWith(`${normalizedPrefix}/`);
  });
  if (!allowedPrefix) {
    return false;
  }

  if (cleanPath.endsWith("/")) {
    return true;
  }

  if (policy.allowedExtensions.length > 0) {
    const dotIndex = lastSegment.lastIndexOf(".");
    if (dotIndex === -1) {
      return false;
    }
    const extension = lastSegment.slice(dotIndex);
    if (!policy.allowedExtensions.includes(extension)) {
      return false;
    }
  }

  return true;
}

function validatePlanAgainstPolicy(plan, policy) {
  const reasons = [];

  const actions = Array.isArray(plan.actions) ? plan.actions : [];
  if (!Array.isArray(actions)) {
    reasons.push("actions must be an array");
    return reasons;
  }
  if (actions.length > policy.maxActionsPerAgent) {
    reasons.push(
      `actions exceed policy max (${actions.length} > ${policy.maxActionsPerAgent})`
    );
  }

  actions.forEach((action, index) => {
    if (!action || typeof action !== "object") {
      reasons.push(`action[${index}] must be an object`);
      return;
    }

    const actionType = normalizeActionType(action.type);
    if (!actionType) {
      reasons.push(`action[${index}]: missing type`);
      return;
    }
    if (!policy.allowedActions.includes(actionType === "replace" ? "write" : actionType)) {
      reasons.push(`action[${index}]: type "${actionType}" not allowed`);
      return;
    }

    if (actionType === "write" || actionType === "append" || actionType === "replace") {
      if (!action.path || typeof action.path !== "string") {
        reasons.push(`action[${index}]: missing path for ${actionType}`);
        return;
      }
      if (!isPathAllowed(action.path, policy)) {
        reasons.push(`action[${index}]: path "${action.path}" fails allowlist`);
      }
      if (!["write", "append"].includes(actionType) && actionType !== "replace") {
        return;
      }
      if (action.content !== undefined && typeof action.content !== "string") {
        reasons.push(`action[${index}]: content must be a string when provided`);
      }
    }
  });

  return reasons;
}

const promptsDir = join(root, "prompts");
const contextFile = join(promptsDir, AGENT_MAP[AGENT].context);

if (!existsSync(contextFile)) {
  console.error(`Missing context file: ${contextFile}`);
  process.exit(1);
}

const context = readFileSync(contextFile, "utf8");

function loadTaskPrompt(task, agent) {
  // Candidate order: specialized → nested → generic
  const candidates = [
    join("prompts", `${task}-${agent}.md`), // e.g. prompts/1-auth-roles-qa.md
    join("prompts", task, `${agent}.md`), // e.g. prompts/1-auth-roles/qa.md
    join("prompts", `${task}.md`), // fallback: prompts/1-auth-roles.md
  ];

  for (const p of candidates) {
    if (existsSync(p)) {
      const content = readFileSync(p, "utf8");
      console.log(`ℹ️  Using task prompt: ${p}`);
      return content;
    }
  }

  throw new Error(`No prompt file found for task "${task}" (looked for: ${candidates.join(", ")})`);
}

const taskPrompt = loadTaskPrompt(TASK, AGENT);

// Strongly instruct JSON output (no markdown fences)
const jsonEnvelope = `
You are generating a single JSON object (no markdown fences, no commentary).
The schema is:

{
  "agent": "${AGENT.toUpperCase()}",
  "task": "${TASK}",
  "summary": "one-sentence high-level summary",
  "actions": [
    {
      "type": "write" | "append" | "replace",
      "path": "<relative path from repo root>",
      "description": "what/why concisely",
      "content": "if type=write/replace: full contents of the file; if append: the block to append"
    }
  ],
  "verify": [
    "shell command(s) to verify (one per string)",
    "..."
  ],
  "notes": [
    "any caveats or follow-ups"
  ]
}

Rules:
- Output MUST be valid JSON only (UTF-8), no extra text or markdown.
- No code fences.
- Keep file paths accurate relative to the repository root.
- Prefer minimal edits: only source/config files, never caches or node_modules.
- If unknowns exist, propose sensible defaults and mention them in notes.
`;

const fullPrompt = `${context}

---
TASK DETAILS:
${taskPrompt}

---
OUTPUT FORMAT REQUIREMENT:
${jsonEnvelope}
`;

const outDir = join(root, "output", TASK);
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `${AGENT.toUpperCase()}.plan.json`);
const rawFile = join(outDir, `${AGENT.toUpperCase()}.raw.txt`);
const policyFile = join(outDir, `${AGENT.toUpperCase()}.policy-violations.json`);

const model = process.env.GEMINI_MODEL; // optional override via env

console.log(`▶️  Generating plan for agent=${AGENT} task=${TASK}`);

function runOnce() {
  if (LOCAL_AGENT_RUNNER) {
    return {
      status: 0,
      stdout: buildLocalPlanJson(),
      stderr: "",
      signal: null,
      pid: null,
    };
  }

  const args = [
    "-y",
    "@google/gemini-cli@latest",
    "-p",
    fullPrompt,
    "--debug=false",
  ];
  if (model) {
    args.push("--model", model);
  }

  return spawnSync("npx", args, {
    encoding: "utf8",
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
  });
}

function normalizeToJson(stdout) {
  if (!stdout) return null;
  let s = stdout.trim();

  // Remove common markdown fences and keep inner content
  s = s.replace(/```json\s*([\s\S]*?)\s*```/gi, "$1");
  s = s.replace(/```([\s\S]*?)```/g, "$1");

  // Remove common preface lines that some CLIs print
  // We'll just locate the first opening brace and the last closing brace
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  s = s.slice(start, end + 1).trim();

  try {
    JSON.parse(s); // validate
    return s;
  } catch {
    return null;
  }
}

function buildLocalPlanJson() {
  const targetPath = `docs/steer-offline-${TASK}-${AGENT}.md`;
  const localPlan = {
    agent: AGENT.toUpperCase(),
    task: TASK,
    summary: `Deterministic local plan for ${AGENT} on ${TASK}`,
    actions: [
      {
        type: "append",
        path: targetPath,
        description: `Generate deterministic local artifact for ${AGENT}`,
        content:
          "\n- Planned by local mode.\n- Agent: " +
          AGENT +
          "\n- Task: " +
          TASK +
          "\n- Risk: " +
          AGENT_RISK,
      },
    ],
    verify: ["node -e \"console.log('steer local verification hook')\""],
    notes: ["Generated in STEER_LOCAL mode. No external LLM call was executed."],
  };
  return JSON.stringify(localPlan, null, 2);
}

// Attempt 1
let cli = runOnce();
let normalized = normalizeToJson(cli.stdout);

if (!normalized) {
  // Persist raw for debugging
  try {
    writeFileSync(
      rawFile,
      (cli.stdout || "") + "\n--- STDERR ---\n" + (cli.stderr || ""),
      "utf8"
    );
  } catch {}

  console.warn("First attempt produced non-JSON or noisy output. Retrying once...");

  // Attempt 2
  cli = runOnce();
  normalized = normalizeToJson(cli.stdout);
}

if (!normalized) {
  console.error("Gemini returned non-JSON after retry. Raw output saved at:", rawFile);
  console.error("Trimmed stdout (first 2000 chars):\n");
  console.error((cli.stdout || "").slice(0, 2000));
  process.exit(cli.status || 2);
}

// Validate minimal JSON contract
let parsed;
try {
  parsed = JSON.parse(normalized);
} catch (e) {
  console.error("Plan JSON is not parseable after normalization.");
  process.exit(2);
}
if (
  !parsed ||
  typeof parsed !== "object" ||
  !parsed.agent ||
  !parsed.task ||
  !Array.isArray(parsed.actions)
) {
  console.error("Plan JSON missing required keys (agent, task, actions).");
  const debugTo = join(outDir, `${AGENT.toUpperCase()}.invalid.json`);
  writeFileSync(debugTo, normalized, "utf8");
  console.error("Raw payload saved at:", debugTo);
  process.exit(2);
}

if (parsed.actions.length === 0) {
  console.error("Plan JSON has zero actions. Nothing to apply.");
  const debugTo = join(outDir, `${AGENT.toUpperCase()}.empty.json`);
  writeFileSync(debugTo, normalized, "utf8");
  console.error("Raw payload saved at:", debugTo);
  process.exit(2);
}

const policy = getPolicyForAgent(AGENT, AGENT_RISK);
const policyIssues = validatePlanAgainstPolicy(parsed, policy);
if (policyIssues.length > 0) {
  writeFileSync(
    policyFile,
    JSON.stringify(
      {
        task: TASK,
        agent: AGENT,
        risk: AGENT_RISK,
        policy,
        issues: policyIssues,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  console.error(
    `Plan violates governance policy for ${AGENT} (${AGENT_RISK}):\n- ${policyIssues.join("\n- ")}`
  );
  console.error("Governance violations saved at:", policyFile);
  process.exit(2);
}

writeFileSync(outFile, normalized, "utf8");
console.log(`✅ Plan written: ${outFile}`);
