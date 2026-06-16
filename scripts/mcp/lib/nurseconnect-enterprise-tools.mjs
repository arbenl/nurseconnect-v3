import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

function boundedNumber(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function appendCappedOutput(current, chunk, limit = 65536) {
  const next = `${current}${chunk.toString()}`;
  return next.length <= limit ? next : next.slice(-limit);
}

async function runProcess(command, args, cwd) {
  return await new Promise((resolvePromise) => {
    const child = spawn(command, args, { cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout = appendCappedOutput(stdout, chunk)));
    child.stderr.on("data", (chunk) => (stderr = appendCappedOutput(stderr, chunk)));
    child.on("error", (error) => resolvePromise({ exitCode: 1, stdout, stderr: appendCappedOutput(stderr, `\n${error.message}`) }));
    child.on("close", (code) => resolvePromise({ exitCode: typeof code === "number" ? code : 1, stdout, stderr }));
  });
}

function pathMatchesPrefix(file, prefix) {
  return file === prefix || file.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`);
}

export function enterpriseToolSchemas(config, availableSuites) {
  return [
    { name: "project_map", description: "Return a compact NurseConnect project map, package inventory, scripts, and configured QA suites", inputSchema: { type: "object", properties: {} } },
    {
      name: "code_search",
      description: "Search NurseConnect repo code with ripgrep and bounded output",
      inputSchema: { type: "object", properties: { query: { type: "string" }, globs: { type: "array", items: { type: "string" } }, maxResults: { type: "number", minimum: 1, maximum: 300 } }, required: ["query"] },
    },
    { name: "branch_status", description: "Return current branch, git status, merge base, and changed-file inventory", inputSchema: { type: "object", properties: { base: { type: "string" } } } },
    {
      name: "scope_audit",
      description: "Audit changed files against allowed and forbidden repository path prefixes",
      inputSchema: { type: "object", properties: { base: { type: "string" }, allowedPaths: { type: "array", items: { type: "string" } }, forbiddenPaths: { type: "array", items: { type: "string" } } } },
    },
    { name: "modularity_audit", description: "Run the mandatory 150-line changed-file modularity guard", inputSchema: { type: "object", properties: { base: { type: "string" } } } },
    {
      name: "slice_evidence_audit",
      description: "Run slice:evidence against a verify-slice run root, optionally with strict enterprise reviewer gates",
      inputSchema: { type: "object", properties: { runRoot: { type: "string" }, strict: { type: "boolean" }, mustFixDisposition: { type: "string" } }, required: ["runRoot"] },
    },
    { name: "repo_verify", description: "Run a configured NurseConnect QA suite such as release, api, unit, or smoke", inputSchema: { type: "object", properties: { suite: { type: "string", enum: availableSuites(config), default: "release" }, cwd: { type: "string" } } } },
  ];
}

export function createEnterpriseHandlers({ repoRoot, config, availableSuites, runConfiguredCommand }) {
  const git = (args) => runProcess("git", args, repoRoot);
  async function changedFiles(base = "origin/main") {
    const baseDiff = await git(["diff", "--name-only", `${base}...HEAD`]);
    if (baseDiff.exitCode !== 0) return { status: "error", files: [], error: baseDiff.stderr || `unable to diff ${base}...HEAD` };
    const files = new Set();
    baseDiff.stdout.split(/\r?\n/).filter(Boolean).forEach((file) => files.add(file));
    for (const args of [["diff", "--name-only"], ["diff", "--cached", "--name-only"], ["ls-files", "--others", "--exclude-standard"]]) {
      const result = await git(args);
      if (result.exitCode === 0) result.stdout.split(/\r?\n/).filter(Boolean).forEach((file) => files.add(file));
    }
    return { status: "success", files: [...files].sort(), error: "" };
  }
  async function branchStatus(args = {}) {
    const base = typeof args.base === "string" && args.base.trim() ? args.base.trim() : "origin/main";
    const [branch, status, mergeBase, files] = await Promise.all([
      git(["rev-parse", "--abbrev-ref", "HEAD"]),
      git(["status", "--short", "--branch"]),
      git(["merge-base", "HEAD", base]),
      changedFiles(base),
    ]);
    return { status: branch.exitCode === 0 && status.exitCode === 0 && files.status === "success" ? "success" : "error", branch: branch.stdout.trim(), base, mergeBase: mergeBase.exitCode === 0 ? mergeBase.stdout.trim() : null, changedFileCount: files.files.length, changedFiles: files.files.slice(0, 200), statusShort: status.stdout.trim().split(/\r?\n/), errors: [branch.stderr, status.stderr, mergeBase.stderr, files.error].filter(Boolean) };
  }
  async function scopeAudit(args = {}) {
    const base = typeof args.base === "string" && args.base.trim() ? args.base.trim() : "origin/main";
    const allowedPaths = Array.isArray(args.allowedPaths) ? args.allowedPaths.filter(Boolean) : [];
    const forbiddenPaths = Array.isArray(args.forbiddenPaths) ? args.forbiddenPaths.filter(Boolean) : [];
    const diff = await changedFiles(base);
    if (diff.status !== "success") return { status: "error", base, changedFileCount: 0, allowedPaths, forbiddenPaths, outsideAllowed: [], forbidden: [], changedFiles: [], error: diff.error };
    const outsideAllowed = allowedPaths.length === 0 ? [] : diff.files.filter((file) => !allowedPaths.some((prefix) => pathMatchesPrefix(file, prefix)));
    const forbidden = diff.files.filter((file) => forbiddenPaths.some((prefix) => pathMatchesPrefix(file, prefix)));
    return { status: outsideAllowed.length === 0 && forbidden.length === 0 ? "success" : "error", base, changedFileCount: diff.files.length, allowedPaths, forbiddenPaths, outsideAllowed, forbidden, changedFiles: diff.files };
  }
  async function projectMap() {
    const [rootPackageRaw, trackedRaw] = await Promise.all([readFile(resolve(repoRoot, "package.json"), "utf8"), git(["ls-files"])]);
    const rootPackage = JSON.parse(rootPackageRaw);
    const trackedFiles = trackedRaw.stdout.split(/\r?\n/).filter(Boolean);
    const packages = [];
    for (const file of trackedFiles.filter((item) => /^(apps|packages)\/[^/]+\/package\.json$/.test(item))) {
      const pkg = JSON.parse(await readFile(resolve(repoRoot, file), "utf8"));
      packages.push({ path: file, name: pkg.name, scripts: Object.keys(pkg.scripts || {}).sort() });
    }
    const keyDocs = ["AGENTS.md", "docs/plans/current-program.md", "docs/plans/current-tracker.md", "docs/runbooks/slice_workflow.md", ".codex/config.toml", ".mcp-toolkit.json"];
    return { repo: "nurseconnect-v3", root: repoRoot, rootScripts: Object.keys(rootPackage.scripts || {}).sort(), packages: packages.sort((left, right) => left.path.localeCompare(right.path)), keyDocs: trackedFiles.filter((file) => keyDocs.includes(file)), configuredSuites: availableSuites(config) };
  }
  async function codeSearch(args = {}) {
    if (typeof args.query !== "string" || !args.query.trim()) return { status: "error", error: "query is required" };
    const maxResults = boundedNumber(args.maxResults, 80, 1, 300);
    const searchArgs = ["-n", "--color", "never", "--hidden", "--glob", "!**/node_modules/**"];
    for (const glob of Array.isArray(args.globs) ? args.globs : []) if (typeof glob === "string" && glob.trim()) searchArgs.push("--glob", glob.trim());
    const result = await runProcess("rg", [...searchArgs, args.query], repoRoot);
    const lines = result.stdout.split(/\r?\n/).filter(Boolean);
    return { status: result.exitCode <= 1 ? "success" : "error", query: args.query, resultCount: lines.length, truncated: lines.length > maxResults, results: lines.slice(0, maxResults), stderr: result.exitCode > 1 ? result.stderr : undefined };
  }
  async function modularityAudit(args = {}) {
    const base = typeof args.base === "string" && args.base.trim() ? args.base.trim() : "origin/main";
    const result = await runProcess("pnpm", ["modularity:guard", "--", "--base", base], repoRoot);
    return { status: result.exitCode === 0 ? "success" : "error", base, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr };
  }
  async function sliceEvidenceAudit(args = {}) {
    if (typeof args.runRoot !== "string" || !args.runRoot.trim()) return { status: "error", error: "runRoot is required" };
    const commandArgs = ["slice:evidence", "--", "--run-root", args.runRoot.trim()];
    if (args.strict === true) commandArgs.push("--require-reviewers", "sonnet46,gemini", "--require-model-preflight", "--require-model-access", "--require-model-review", "--require-subagent-results", "--require-codex-senior-review", "--require-debate", "--must-fix-disposition", args.mustFixDisposition || "none");
    const result = await runProcess("pnpm", commandArgs, repoRoot);
    return { status: result.exitCode === 0 ? "success" : "error", runRoot: args.runRoot.trim(), strict: args.strict === true, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr };
  }
  return { project_map: projectMap, code_search: codeSearch, branch_status: branchStatus, scope_audit: scopeAudit, modularity_audit: modularityAudit, slice_evidence_audit: sliceEvidenceAudit, repo_verify: (args = {}) => runConfiguredCommand(config, args.suite || "release", args) };
}
