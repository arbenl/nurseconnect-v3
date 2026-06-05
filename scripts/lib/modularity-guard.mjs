import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { MODULARITY_LINE_LIMIT, isModularityChecked } from "../modularity-guard-policy.mjs";

const GIT_BIN = "/usr/bin/git";
const GIT_MAX_BUFFER_BYTES = 16 * 1024 * 1024;
const SAFE_EXEC_ENV = Object.freeze({ PATH: "/usr/bin:/bin:/usr/sbin:/sbin" });

function git(root, args) {
  return execFileSync(GIT_BIN, args, {
    cwd: root,
    encoding: "utf8",
    env: SAFE_EXEC_ENV,
    maxBuffer: GIT_MAX_BUFFER_BYTES,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function tryGit(root, args) {
  try {
    return git(root, args);
  } catch {
    return null;
  }
}

function resolveCommit(root, ref) {
  return tryGit(root, ["rev-parse", "--verify", `${ref}^{commit}`])?.trim() || null;
}

export function resolveModularityBaseRef(root, env = process.env) {
  const candidates = [
    env.MODULARITY_GUARD_BASE_SHA,
    env.GITHUB_BASE_REF ? `origin/${env.GITHUB_BASE_REF}` : null,
    "origin/main",
    "main",
    "HEAD~1",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const commit = resolveCommit(root, candidate);
    if (commit) return { ref: candidate, commit };
  }
  return null;
}

export function parseNameStatus(output) {
  const tokens = String(output || "").split("\0").filter(Boolean);
  const entries = [];
  for (let index = 0; index < tokens.length; ) {
    const status = tokens[index++];
    if (!status) continue;
    if (status.startsWith("R") || status.startsWith("C")) {
      entries.push({ file: tokens[index + 1], oldPath: tokens[index], status: status[0] });
      index += 2;
    } else {
      entries.push({ file: tokens[index++], oldPath: null, status: status[0] });
    }
  }
  return entries;
}

function untrackedFiles(root) {
  return git(root, ["ls-files", "--others", "--exclude-standard", "-z"])
    .split("\0")
    .filter(Boolean)
    .map((file) => ({ file, oldPath: null, status: "A" }));
}

function changedFiles(root, baseCommit) {
  const output = git(root, ["diff", "--name-status", "-z", "--find-renames", "--diff-filter=ACMR", baseCommit, "--"]);
  return [...parseNameStatus(output), ...untrackedFiles(root)];
}

export function lineCount(text) {
  if (text.length === 0) return 0;
  const newlines = text.match(/\n/gu)?.length ?? 0;
  return text.endsWith("\n") ? newlines : newlines + 1;
}

function currentLineCount(root, filePath) {
  return lineCount(readFileSync(path.join(root, filePath), "utf8"));
}

function baseLineCount(root, baseCommit, filePath) {
  const output = tryGit(root, ["show", `${baseCommit}:${filePath}`]);
  return output == null ? null : lineCount(output);
}

function evaluateEntry(root, baseCommit, entry) {
  if (!entry.file || !isModularityChecked(entry.file)) return null;
  const currentLines = currentLineCount(root, entry.file);
  const basePath = entry.oldPath ?? entry.file;
  const baseLines = entry.status === "A" || entry.status === "C" ? null : baseLineCount(root, baseCommit, basePath);

  if (baseLines == null) {
    return currentLines > MODULARITY_LINE_LIMIT ? { ...entry, baseLines, currentLines, reason: "new-file-over-limit" } : null;
  }
  if (baseLines > MODULARITY_LINE_LIMIT) {
    return currentLines > baseLines ? { ...entry, baseLines, currentLines, reason: "legacy-file-grew" } : null;
  }
  return currentLines > MODULARITY_LINE_LIMIT ? { ...entry, baseLines, currentLines, reason: "modified-file-over-limit" } : null;
}

export function evaluateModularityGuard(options = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  const base = options.baseRef
    ? { ref: options.baseRef, commit: resolveCommit(root, options.baseRef) }
    : resolveModularityBaseRef(root, options.env ?? process.env);

  if (!base?.commit) {
    return {
      base: null,
      status: "skipped",
      violations: [],
      warning: "Modularity guard skipped: no base ref resolved.",
    };
  }

  const entries = changedFiles(root, base.commit);
  return {
    base,
    checkedFiles: entries.filter((entry) => isModularityChecked(entry.file)).length,
    status: "checked",
    violations: entries.map((entry) => evaluateEntry(root, base.commit, entry)).filter(Boolean),
  };
}
