#!/usr/bin/env node
/**
 * Usage:
 *   node scripts/steer-deliver.mjs <task-id> [--risk low|medium|high] [--include-optional] [--skip-verification-gates]
 *   [--title "…"] [--body "…"] [--commit-message "…"] [--base main] [--branch <name>] [--allow-dirty]
 *
 * Runs:
 *   1) steer orchestrate (run + gates + verify)
 *   2) git commit + push
 *   3) PR create/update + checks watch
 *   4) mergeability + copilot review/comment gating
 *
 * No automatic merge.
 */

import { fileURLToPath } from "node:url";
import path from "node:path";
import { existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const TASK_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const DEFAULT_BASE_BRANCH = "main";
const DEFAULT_TITLE = "feat: steer orchestration delivery";
const DEFAULT_BODY = "Steer orchestrated deterministic run/verify with governance gates and verification report.";
const DEFAULT_COMMIT_MESSAGE = "feat: add steer deterministic orchestration outputs";

function parseArgs(argv) {
  const parsed = {
    task: null,
    risk: process.env.RISK || "low",
    includeOptional: false,
    skipVerificationGates: process.env.SKIP_VERIFICATION_GATES === "1" || process.env.SKIP_VERIFICATION_GATES === "true",
    title: DEFAULT_TITLE,
    body: DEFAULT_BODY,
    commitMessage: DEFAULT_COMMIT_MESSAGE,
    baseBranch: process.env.BASE_BRANCH || DEFAULT_BASE_BRANCH,
    branch: null,
    allowDirty: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (!arg.startsWith("--") && !parsed.task) {
      parsed.task = arg;
      continue;
    }

    if (arg === "--risk" || arg === "--level") {
      parsed.risk = argv[i + 1] || parsed.risk;
      i += 1;
      continue;
    }

    if (arg.startsWith("--risk=") || arg.startsWith("--level=")) {
      parsed.risk = arg.split("=").at(1) || parsed.risk;
      continue;
    }

    if (arg === "--title") {
      parsed.title = argv[i + 1] || parsed.title;
      i += 1;
      continue;
    }

    if (arg.startsWith("--title=")) {
      parsed.title = arg.split("=").at(1) || parsed.title;
      continue;
    }

    if (arg === "--body") {
      parsed.body = argv[i + 1] || parsed.body;
      i += 1;
      continue;
    }

    if (arg.startsWith("--body=")) {
      parsed.body = arg.split("=").at(1) || parsed.body;
      continue;
    }

    if (arg === "--commit-message") {
      parsed.commitMessage = argv[i + 1] || parsed.commitMessage;
      i += 1;
      continue;
    }

    if (arg.startsWith("--commit-message=")) {
      parsed.commitMessage = arg.split("=").at(1) || parsed.commitMessage;
      continue;
    }

    if (arg === "--base") {
      parsed.baseBranch = argv[i + 1] || parsed.baseBranch;
      i += 1;
      continue;
    }

    if (arg === "--branch") {
      parsed.branch = argv[i + 1] || parsed.branch;
      i += 1;
      continue;
    }

    if (arg.startsWith("--branch=")) {
      parsed.branch = arg.split("=").at(1) || parsed.branch;
      continue;
    }

    if (arg === "--include-optional") {
      parsed.includeOptional = true;
      continue;
    }

    if (arg === "--skip-verification-gates") {
      parsed.skipVerificationGates = true;
      continue;
    }

    if (arg === "--allow-dirty") {
      parsed.allowDirty = true;
      continue;
    }
  }

  return parsed;
}

function validateTask(task) {
  const normalizedTask = String(task || "");
  if (!TASK_ID_PATTERN.test(normalizedTask)) {
    throw new Error(
      `Invalid task id "${task}". Use a safe slug (letters, numbers, hyphen, underscore, dot) with no path separators.`
    );
  }
  return normalizedTask;
}

function runCommand(command, args, options = {}) {
  const proc = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    stdio: options.stdio || ["inherit", "inherit", "inherit"],
    env: {
      ...process.env,
      ...options.env,
    },
  });

  if (proc.error) {
    throw proc.error;
  }

  const status = proc.status ?? -1;
  if (status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${status}`
    );
  }

  return proc;
}

function runCommandCapture(command, args, options = {}) {
  const proc = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    stdio: ["inherit", "pipe", "pipe"],
    env: {
      ...process.env,
      ...options.env,
    },
  });

  if (proc.error) {
    throw proc.error;
  }

  const status = proc.status ?? -1;
  if (status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${status}\n${proc.stderr || proc.stdout || ""}`
    );
  }

  return proc.stdout || "";
}

function runJsonCommand(command, args, options = {}) {
  const raw = runCommandCapture(command, args, options).trim();
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed parsing JSON from: ${command} ${args.join(" ")}\n${raw.slice(0, 2048)}\n${error}`);
  }
}

function getCurrentBranch() {
  const out = runCommandCapture("git", ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
  if (!out || out === "HEAD") {
    throw new Error("Not on a branch. Run on a checked-out branch or pass --branch <name>.");
  }
  return out;
}

function getRepoOwnerRepo() {
  const originUrl = runCommandCapture("git", ["config", "--get", "remote.origin.url"]).trim();
  const normalized = originUrl
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/\.git$/, "");
  const match = normalized.match(/github\.com\/([^/]+\/[^/]+)$/);
  if (!match) {
    throw new Error(`Unable to parse owner/repo from origin URL: ${originUrl}`);
  }
  return match[1];
}

function isCopilotActor(actor) {
  if (!actor || !actor.login) {
    return false;
  }
  const login = actor.login.toLowerCase();
  return /copilot/.test(login) || /copilot/.test(actor.name || "");
}

function collectCopilotFindings(prNumber, ownerRepo) {
  const findings = [];
  const reviews = runJsonCommand("gh", ["api", "--paginate", `/repos/${ownerRepo}/pulls/${prNumber}/reviews`]);
  for (const review of Array.isArray(reviews) ? reviews : []) {
    if (!isCopilotActor(review.user)) {
      continue;
    }
    const body = String(review.body || "").trim();
    if (!body) {
      continue;
    }
    findings.push({
      source: "review",
      state: review.state || "unknown",
      url: review.html_url || review.url || "review-url-unavailable",
      author: review.user?.login || "unknown",
      message: body,
    });
  }

  const comments = runJsonCommand("gh", ["api", "--paginate", `/repos/${ownerRepo}/pulls/${prNumber}/comments`]);
  for (const comment of Array.isArray(comments) ? comments : []) {
    if (!isCopilotActor(comment.user)) {
      continue;
    }
    const body = String(comment.body || "").trim();
    if (!body) {
      continue;
    }
    findings.push({
      source: "comment",
      url: comment.html_url || "comment-url-unavailable",
      author: comment.user?.login || "unknown",
      message: body,
    });
  }

  return findings;
}

function formatCopilotFinding(finding, index) {
  return `${index + 1}. ${finding.source} by ${finding.author}\n   ${finding.url}\n   ${finding.message.slice(0, 200)}`;
}

function ensureToolingPresent() {
  runCommand("gh", ["--version"]);
  runCommand("git", ["--version"]);
}

function sleepMs(ms) {
  const safeDelayMs = Number(ms);
  if (!Number.isFinite(safeDelayMs) || safeDelayMs <= 0) {
    return;
  }
  const seconds = safeDelayMs / 1000;
  spawnSync("node", ["-e", `setTimeout(() => {}, ${seconds * 1000});`], {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
    shell: false,
  });
}

function hasTaskFiles(basePath) {
  const check = runCommandCapture("find", [basePath, "-mindepth", "1", "-maxdepth", "3", "-type", "f", "-print"]).trim();
  return check.length > 0;
}

function collectFiles(basePath) {
  const entries = readdirSync(basePath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(basePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function isIgnoredByGit(relativePath) {
  const proc = spawnSync("git", ["check-ignore", "-q", relativePath], {
    cwd: root,
    encoding: "utf8",
    shell: false,
    stdio: ["inherit", "pipe", "pipe"],
  });

  if (proc.error) {
    throw proc.error;
  }

  if (proc.status === 0) {
    return true;
  }
  if (proc.status === 1) {
    return false;
  }

  const message = proc.stderr || proc.stdout || "";
  throw new Error(`Failed to evaluate gitignore state for ${relativePath}: ${String(message).trim()}`);
}

function stageTaskArtifacts(task) {
  const artifactDir = `artifacts/${task}`;
  const outputDir = `output/${task}`;
  const artifactPath = path.join(root, artifactDir);
  const outputPath = path.join(root, outputDir);
  const stageTargets = [];
  if (existsSync(artifactPath) && hasTaskFiles(artifactPath)) {
    const files = collectFiles(artifactPath);
    const trackableFiles = files
      .map((absPath) => path.relative(root, absPath))
      .filter((filePath) => !isIgnoredByGit(filePath));

    if (trackableFiles.length === 0) {
      log(`Skipping ${artifactDir} because all produced files are ignored by .gitignore.`);
    } else {
      stageTargets.push(...trackableFiles);
    }
  }

  if (existsSync(outputPath) && hasTaskFiles(outputPath)) {
    const files = collectFiles(outputPath);
    const trackableFiles = files
      .map((absPath) => path.relative(root, absPath))
      .filter((filePath) => !isIgnoredByGit(filePath));

    if (trackableFiles.length === 0) {
      log(`Skipping ${outputDir} because all produced files are ignored by .gitignore.`);
    } else {
      stageTargets.push(...trackableFiles);
    }
  }
  if (stageTargets.length === 0) {
    throw new Error(`No artifacts were produced for task ${task}.`);
  }

  runCommand("git", ["add", "--", ...stageTargets]);

  const staged = runCommandCapture("git", ["diff", "--cached", "--name-only"]).trim();
  if (!staged) {
    throw new Error(`No changes detected after staging task artifacts for ${task}.`);
  }
  return staged.split("\n").filter(Boolean);
}
function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.task) {
    console.error("Usage: node scripts/steer-deliver.mjs <task-id> [options]");
    process.exit(1);
  }
  const task = validateTask(parsed.task);
  const branch = parsed.branch || getCurrentBranch();

  ensureToolingPresent();

  if (!parsed.allowDirty) {
    const gitStatus = runCommandCapture("git", ["status", "--short"]).trim();
    if (gitStatus) {
      throw new Error(
        "Working tree is dirty. Re-run with --allow-dirty or commit/stash unrelated changes first."
      );
    }
  }

  const runArgs = [task, "--risk", parsed.risk, ...(parsed.includeOptional ? ["--include-optional"] : []), ...(parsed.skipVerificationGates ? ["--skip-verification-gates"] : [])];
  runCommand("node", ["scripts/steer-run-and-verify.mjs", ...runArgs]);

  stageTaskArtifacts(task);
  runCommand("git", ["commit", "-m", parsed.commitMessage]);

  runCommand("git", ["push", "-u", "origin", branch]);

  let prNumber = null;
  const prList = runJsonCommand("gh", ["pr", "list", "--state", "open", "--head", branch, "--json", "number", "--limit", "1"]);
  if (Array.isArray(prList) && prList.length > 0) {
    prNumber = prList[0]?.number;
  }

  if (!prNumber) {
    const createdPrUrl = runCommandCapture(
      "gh",
      ["pr", "create", "--title", parsed.title, "--body", parsed.body, "--base", parsed.baseBranch, "--head", branch]
    ).trim();
    const match = createdPrUrl.match(/\/pull\/(\d+)$/);
    if (!match) {
      throw new Error(`Unable to read PR number from: ${createdPrUrl}`);
    }
    prNumber = Number(match[1]);
  }

  console.log(`PR #${prNumber} is ready. Running CI checks.`);
  let checksPassed = false;
  const maxCheckWatchAttempts = 6;
  for (let attempt = 1; attempt <= maxCheckWatchAttempts; attempt += 1) {
    try {
      runCommandCapture("gh", ["pr", "checks", `${prNumber}`, "--watch"]);
      checksPassed = true;
      break;
    } catch (error) {
      const message = String(error?.message || "");
      if (!/no checks reported/i.test(message) || attempt >= maxCheckWatchAttempts) {
        throw error;
      }
      console.log(`No checks reported yet for PR #${prNumber}; retrying in 20s (${attempt}/${maxCheckWatchAttempts})`);
      sleepMs(20000);
    }
  }
  if (!checksPassed) {
    throw new Error(`CI checks did not start for PR #${prNumber} after retries.`);
  }

  const prMeta = runJsonCommand("gh", ["pr", "view", `${prNumber}`, "--json", "mergeable", "mergeStateStatus", "headRefName"]);
  if (prMeta.mergeable !== "MERGEABLE") {
    throw new Error(
      `PR #${prNumber} is not mergeable (${prMeta.mergeable}). Resolve conflicts first.`
    );
  }
  if (prMeta.mergeStateStatus && prMeta.mergeStateStatus !== "CLEAN") {
    throw new Error(
      `PR #${prNumber} merge state is ${prMeta.mergeStateStatus}. Resolve conflicts before merge.`
    );
  }

  const ownerRepo = getRepoOwnerRepo();
  const copilotFindings = collectCopilotFindings(prNumber, ownerRepo);
  if (copilotFindings.length > 0) {
    console.error(`Blocking Copilot findings for PR #${prNumber}:`);
    copilotFindings.forEach((finding, index) => {
      console.error(formatCopilotFinding(finding, index));
    });
    throw new Error("Address Copilot comments before merge.");
  }

  console.log(
    `✅ All gates passed for PR #${prNumber}. No merge blockers detected, but merge was intentionally not run automatically.
Ready to merge when you are ready: gh pr merge --squash #${prNumber}`
  );
}

try {
  main();
} catch (error) {
  console.error(error?.message || String(error));
  process.exit(1);
}
