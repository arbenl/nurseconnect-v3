import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function cleanGitEnv(source = process.env) {
  const env = { ...source };
  for (const key of Object.keys(env)) if (key.toUpperCase().startsWith("GIT_")) delete env[key];
  return env;
}

export function manifestSha(file = "slice-gates.yaml") {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

export function collectSpecialChangedFiles(base, cwd) {
  if (!hasSpecialLineage(base, cwd)) throw new Error("Special-mode HEAD is not descended from the policy base.");
  const gitEnv = cleanGitEnv();
  const files = new Set();
  for (const args of [
    ["diff", "--no-renames", "--name-only", base, "HEAD"], ["diff", "--no-renames", "--name-only", "--cached"],
    ["diff", "--no-renames", "--name-only"], ["ls-files", "--others", "--exclude-standard"],
  ]) {
    const result = spawnSync("git", args, { cwd, encoding: "utf8", env: gitEnv });
    if (result.status !== 0) throw new Error(`Unable to enumerate special-mode changes: ${(result.stderr || result.stdout).trim()}`);
    for (const file of result.stdout.split(/\r?\n/).filter(Boolean)) files.add(file);
  }
  return [...files].sort();
}
export function collectRegularHeadFiles(files, cwd = ".") {
  return files.filter((file) => { try { return lstatSync(join(cwd, file)).isFile(); } catch { return false; } });
}
function hasSpecialLineage(base, cwd) {
  const gitEnv = cleanGitEnv();
  if (spawnSync("git", ["merge-base", "--is-ancestor", base, "HEAD"], { cwd, env: gitEnv }).status === 0) return true;
  const baseSha = spawnSync("git", ["rev-parse", "--verify", `${base}^{commit}`], { cwd, encoding: "utf8", env: gitEnv });
  const head = spawnSync("git", ["cat-file", "-p", "HEAD"], { cwd, encoding: "utf8", env: gitEnv });
  return baseSha.status === 0 && head.status === 0 && head.stdout.split(/\r?\n\r?\n/, 1)[0].split(/\r?\n/).includes(`parent ${baseSha.stdout.trim()}`);
}

export function writeEvidence({ runRoot, manifest, sha, changedFiles, hits, errors, promotion = {} }) {
  const dir = join(runRoot, "evidence");
  mkdirSync(dir, { recursive: true });
  const verdict = errors.length === 0 ? "PASS" : "FAIL";
  const payload = { status: verdict.toLowerCase(), manifest, manifestSha: sha, promotion, changedFiles, hits, errors };
  writeFileSync(join(dir, "ent-gates.json"), `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(join(dir, "ent-gates.md"), markdown({ verdict, sha, manifest, promotion, hits, errors }));
}

function markdown({ verdict, sha, manifest, promotion, hits, errors }) {
  const lines = [
    "# Enterprise Gates Evidence",
    "",
    `- ent-gates: ${verdict}`,
    `- slice: ${manifest?.slice || "unknown"}`,
    `- branch: ${manifest?.branch || "unknown"}`,
    `- promotion mode: ${promotion?.mode || "standard"}`,
    `- policy base sha: ${promotion?.baseSha || "not-recorded"}`,
    `- source branch: ${promotion?.sourceBranch || "not-recorded"}`,
    `- manifest sha256: ${sha}`,
    "",
    "## Declarations",
  ];
  for (const [gate, value] of Object.entries(manifest?.gates || {})) lines.push(`- ${gate}: ${value.status}`);
  lines.push("", "## Guarded Path Hits");
  for (const [gate, files] of Object.entries(hits || {})) lines.push(`- ${gate}: ${files.length ? files.join(", ") : "none"}`);
  if (errors.length) lines.push("", "## Errors", ...errors.map((error) => `- ${error}`));
  return `${lines.join("\n")}\n`;
}
