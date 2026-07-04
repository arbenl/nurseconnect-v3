#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkServiceRequestStatusWrites } from "./lib/service-request-status-guard.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
export const LINE_LIMIT = 150;
export const PRE_RLS_DATABASE_ALLOWANCE = {
  packages: /^@nurseconnect\/(?:domain-.+|platform-telemetry)$/,
  imports: new Set(["@nurseconnect/database", "@nurseconnect/database/schema"]),
  removeBy: "NC-E1-02 / rls-platform-mechanism",
};
export const TRANSITIONAL_DOMAIN_ALLOWLIST = [
  { from: "@nurseconnect/domain-dispatch", to: "@nurseconnect/domain-request", testOnly: false, required: true },
  { from: "@nurseconnect/domain-admin-ops", to: "@nurseconnect/domain-nurse", testOnly: false, required: true },
  { from: "@nurseconnect/domain-identity", to: "@nurseconnect/domain-nurse", testOnly: true, required: true },
];
const sourceExt = /\.(?:ts|tsx|js|mjs)$/;
const packageSource = /^packages\/[^/]+\/src\/.+\.(?:ts|tsx|js|mjs)$/;
const lineGuardSource = /^(?:apps\/web\/src|packages\/[^/]+\/src)\/.+\.(?:ts|tsx|js|mjs)$/;
const testFile = /(?:^|\/)(?:__tests__\/.+|.+\.(?:test|spec)\.(?:ts|tsx|js|mjs))$/;
const lineExempt = [
  /\.d\.ts$/,
  testFile,
  /^apps\/web\/src\/app\/.*\/(?:page|layout|route|error|global-error|not-found)\.tsx?$/,
  /^apps\/web\/src\/components\//,
  /(?:^|\/)(?:vitest|vite|next|tailwind|postcss|playwright|components)\.config\.(?:ts|js|mjs)$/,
  /(?:^|\/)(?:setup|vitest\.setup)\.(?:ts|js|mjs)$/,
];

function git(args, options = {}) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", ...options });
}

function lines(value) {
  return String(value || "").split("\n").filter(Boolean);
}

function packageName(file) {
  const match = file.match(/^packages\/([^/]+)\//);
  if (!match) return "";
  const packageJson = path.join(repoRoot, "packages", match[1], "package.json");
  return existsSync(packageJson) ? JSON.parse(readFileSync(packageJson, "utf8")).name : "";
}

function importedPackage(specifier) {
  const match = specifier.match(/^(@nurseconnect\/[^/]+)/);
  return match?.[1] || "";
}

export function isTestFile(file) {
  return testFile.test(file);
}

export function importSpecifiers(text) {
  const specs = [];
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[^"']*?\s+from\s*)?["'](@nurseconnect\/[^"']+)["']/g,
    /\bexport\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s*["'](@nurseconnect\/[^"']+)["']/g,
    /\bimport\s*\(\s*["'](@nurseconnect\/[^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) specs.push(match[1]);
  }
  return specs;
}

export function checkPackageBoundaries(files, readText) {
  const violations = [];
  const usedAllowlist = new Set();
  for (const file of files.filter((item) => packageSource.test(item))) {
    const from = packageName(file);
    if (!from) continue;
    for (const specifier of importSpecifiers(readText(file))) {
      const to = importedPackage(specifier);
      if (!to || to === from || to === "@nurseconnect/contracts") continue;
      if (PRE_RLS_DATABASE_ALLOWANCE.imports.has(to) && PRE_RLS_DATABASE_ALLOWANCE.packages.test(from)) continue;
      if ((to === "@nurseconnect/platform-telemetry" || to === "@nurseconnect/platform-authz") && from.startsWith("@nurseconnect/domain-")) continue;
      const allow = TRANSITIONAL_DOMAIN_ALLOWLIST.find((rule) =>
        rule.from === from && rule.to === to && (!rule.testOnly || isTestFile(file))
      );
      if (allow) {
        usedAllowlist.add(`${allow.from}->${allow.to}:${allow.testOnly ? "test" : "runtime"}`);
        continue;
      }
      if (from.startsWith("@nurseconnect/domain-") && to.startsWith("@nurseconnect/domain-")) {
        violations.push(`${file}: illegal cross-domain import ${from} -> ${specifier}`);
      } else if (to === "@nurseconnect/ui" && from !== "@nurseconnect/ui") {
        violations.push(`${file}: @nurseconnect/ui is not allowed from scanned package source`);
      } else if (to.startsWith("@nurseconnect/")) {
        violations.push(`${file}: unsupported package dependency ${from} -> ${specifier}`);
      }
    }
  }
  for (const rule of TRANSITIONAL_DOMAIN_ALLOWLIST.filter((item) => item.required)) {
    const key = `${rule.from}->${rule.to}:${rule.testOnly ? "test" : "runtime"}`;
    if (!usedAllowlist.has(key)) violations.push(`unused required transitional allowlist entry ${key}`);
  }
  return violations;
}

function baseRef() {
  const ref = process.env.ARCH_BOUNDARY_BASE || "origin/main";
  try {
    git(["rev-parse", "--verify", `${ref}^{commit}`], { stdio: ["ignore", "pipe", "ignore"] });
    return ref;
  } catch {
    throw new Error(`base ref is unavailable: ${ref}`);
  }
}

function changedFiles(base) {
  const rows = new Map();
  let baseDiff = "";
  try {
    baseDiff = git(["diff", "--name-status", "-z", `${base}...HEAD`]);
  } catch {
    baseDiff = git(["diff", "--name-status", "-z", base, "HEAD"]);
  }
  for (const change of parseNameStatus(baseDiff)) rows.set(change.file, change);
  for (const change of parseNameStatus(git(["diff", "--name-status", "-z"]))) rows.set(change.file, change);
  for (const change of parseNameStatus(git(["diff", "--cached", "--name-status", "-z"]))) rows.set(change.file, change);
  for (const file of lines(git(["ls-files", "--others", "--exclude-standard"]))) rows.set(file, { file, status: "A" });
  return [...rows.values()];
}

export function parseNameStatus(text) {
  const fields = String(text || "").split("\0").filter(Boolean);
  const changes = [];
  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    const kind = status[0];
    if (kind === "R" || kind === "C") {
      const previousFile = fields[index++];
      const file = fields[index++];
      changes.push({ file, previousFile, status: kind });
    } else {
      changes.push({ file: fields[index++], status: kind });
    }
  }
  return changes.filter((change) => change.file);
}

function count(text) {
  return text === "" ? 0 : text.split(/\r?\n/).length - (text.endsWith("\n") ? 1 : 0);
}
function baseText(base, file) {
  try {
    return git(["show", `${base}:${file}`], { stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

export function checkLineGuard(changes, readCurrent, readBase = () => "") {
  const violations = [];
  for (const { file, previousFile, status } of changes) {
    if (status === "D") continue;
    if (!lineGuardSource.test(file) || lineExempt.some((rule) => rule.test(file))) continue;
    const current = count(readCurrent(file));
    const previous = status === "A" ? 0 : count(readBase(previousFile || file));
    if (status === "A" && current > LINE_LIMIT) violations.push(`${file}: new file has ${current} lines (limit ${LINE_LIMIT})`);
    if (status !== "A" && current > LINE_LIMIT && current > previous) {
      violations.push(`${file}: grew from ${previous} to ${current} lines while over limit ${LINE_LIMIT}`);
    }
  }
  return violations;
}

function main() {
  const tracked = lines(git(["ls-files"])).filter((file) => sourceExt.test(file));
  const base = baseRef(), currentText = new Map();
  const readCurrent = (file) => currentText.get(file) ?? currentText.set(file, readFileSync(path.join(repoRoot, file), "utf8")).get(file);
  const boundary = checkPackageBoundaries(tracked, readCurrent);
  const modularity = checkLineGuard(changedFiles(base), readCurrent, (file) => baseText(base, file));
  const failures = [...boundary, ...modularity, ...checkServiceRequestStatusWrites(tracked, readCurrent)];
  if (failures.length > 0) {
    process.stderr.write(`[architecture-boundaries] FAIL (${failures.length})\n${failures.map((item) => `- ${item}`).join("\n")}\n`);
    process.exit(1);
  }
  process.stdout.write(`[architecture-boundaries] PASS packages=${tracked.filter((file) => packageSource.test(file)).length} changed=${changedFiles(base).length} preRlsDbRemoval="${PRE_RLS_DATABASE_ALLOWANCE.removeBy}"\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`[architecture-boundaries] FAIL ${error.message}\n`);
    process.exit(1);
  }
}
