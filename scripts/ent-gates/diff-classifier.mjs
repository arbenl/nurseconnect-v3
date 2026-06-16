import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

export function loadGatePaths(file = "config/ent-gate-paths.json", base = "", allowHeadFallback = false) {
  const headConfig = JSON.parse(readFileSync(file, "utf8"));
  if (base && base !== "HEAD") {
    const result = spawnSync("git", ["show", `${base}:${file}`], { encoding: "utf8" });
    if (result.status === 0) return JSON.parse(result.stdout);
    if (!allowHeadFallback) throw new Error(`Unable to load base gate paths from ${base}:${file}.`);
  }
  return headConfig;
}

export function collectChangedFiles({ base = "HEAD", explicit = [], explicitComplete = false } = {}) {
  const files = new Set(explicit.filter(Boolean));
  if (explicitComplete) return [...files].sort();
  for (const args of [
    ["diff", "--name-only", `${base}...HEAD`],
    ["diff", "--name-only", "--cached"],
    ["diff", "--name-only"],
    ["ls-files", "--others", "--exclude-standard"],
  ]) {
    const result = spawnSync("git", args, { encoding: "utf8" });
    if (result.status !== 0 && args[0] === "diff" && String(args[2] || "").includes("...") && !explicitComplete) {
      throw new Error(`Unable to collect changed files from ${base}...HEAD: ${(result.stderr || result.stdout).trim()}`);
    }
    if (result.status === 0) for (const file of result.stdout.split(/\r?\n/).filter(Boolean)) files.add(file);
  }
  return [...files].sort();
}

export function classifyChangedFiles(files, config) {
  const hits = {};
  for (const [gate, patterns] of Object.entries(config.gates || {})) {
    const compiled = patterns.map(globToRegex);
    hits[gate] = files.filter((file) => compiled.some((pattern) => pattern.test(file)));
  }
  return hits;
}

export function validateGuardedOverrides(manifest, hits) {
  const errors = [];
  for (const [gate, files] of Object.entries(hits)) {
    if (files.length > 0 && manifest.gates?.[gate]?.status === "n/a") {
      errors.push(`${gate} cannot be n/a; guarded paths changed: ${files.join(", ")}`);
    }
  }
  return errors;
}

function globToRegex(glob) {
  const escaped = glob
    .replace(/\/\*\*\//g, "/<<<GLOBSTAR_SLASH>>>")
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "<<<GLOBSTAR>>>")
    .replace(/\*/g, "[^/]*")
    .replace(/<<<GLOBSTAR_SLASH>>>/g, "(?:.*/)?")
    .replace(/<<<GLOBSTAR>>>/g, ".*");
  return new RegExp(`^${escaped}$`);
}
