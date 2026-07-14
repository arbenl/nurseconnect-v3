#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { classifyChangedFiles, collectChangedFiles, loadGatePaths, validateGuardedOverrides } from "./diff-classifier.mjs";
import { cleanGitEnv, collectRegularHeadFiles, collectSpecialChangedFiles, manifestSha, writeEvidence } from "./evidence.mjs";
import { loadManifest, validateManifest } from "./manifest.mjs";
import { parseEnterprisePromotionState, parseProgramPromotionState, parseTrackerPromotionState, resolveSourceBranch, validatePromotionPolicy } from "./promotion-policy.mjs";
function parseArgs(argv) {
  const args = { changedFile: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--") continue;
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (key === "changed-file") { args.changedFile.push(next); index += 1; }
    else if (next && !next.startsWith("--")) { args[key] = next; index += 1; }
    else args[key] = "true";
  }
  return args;
}
export function run(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  const runRoot = args["run-root"] || "tmp/ent-gates";
  const loaded = loadManifest(args.manifest || "slice-gates.yaml");
  const manifest = loaded.manifest || { gates: {} };
  const base = args.base || env.BASE_COMMIT || "origin/main";
  const policyBase = args["policy-base"] || env.GATE_POLICY_BASE || base;
  const prContext = Boolean(env.GITHUB_BASE_REF || env.GITHUB_EVENT_NAME === "pull_request");
  const onLocalMain = currentBranch() === "main" && !prContext;
  const enforcePromotion = args["enforce-promotion"] === "true" || (args["enforce-promotion"] !== "false" && !onLocalMain);
  const enforceDiffEvidence = args["enforce-diff-evidence"] === "false" ? false : enforcePromotion;
  const errors = [...(loaded.errors || [])];
  let changedFiles = [];
  let hits = {};
  let promotion = { mode: manifest["promotion-mode"] || "standard" };
  try {
    changedFiles = collectChangedFiles({ base, explicit: args.changedFile, explicitComplete: args["changed-files-complete"] === "true" });
  } catch (error) {
    errors.push(error.message);
  }
  try {
    const specialMode = ["authority", "bootstrap"].includes(promotion.mode);
    const trackerPath = specialMode ? "docs/plans/current-tracker.md" : args.tracker || "docs/plans/current-tracker.md";
    if (specialMode && args.tracker) errors.push("Special promotion mode cannot override the canonical tracker path.");
    if (specialMode && args["enforce-promotion"] === "false") errors.push("Special promotion mode cannot disable promotion enforcement.");
    const trackerText = loadTrackerText({ path: trackerPath, base: policyBase, enforcePromotion: specialMode || enforcePromotion });
    errors.push(...validateManifest({
      manifest,
      changedFiles,
      trackerText,
      enforcePromotion: specialMode ? false : enforcePromotion,
      enforceDiffEvidence: specialMode || enforceDiffEvidence,
    }));
    if (specialMode) promotion = validateSpecialPromotion({ args, env, manifest, changedFiles, trackerPath, trackerText, base, policyBase });
    errors.push(...(promotion.errors || []));
  } catch (error) {
    errors.push(`Unable to validate manifest: ${error.message}`);
  }
  try {
    const configPath = args.config || "config/ent-gate-paths.json";
    const configChanged = changedFiles.includes(configPath);
    const completeListFallback = args["changed-files-complete"] === "true" && !configChanged;
    const bootstrapFallback = manifest.slice === "NC-EG-01" && configChanged && baseRefAvailable(policyBase);
    const allowBootstrap = completeListFallback || bootstrapFallback;
    hits = classifyChangedFiles(changedFiles, loadGatePaths(configPath, policyBase, allowBootstrap));
    errors.push(...validateGuardedOverrides(manifest, hits));
  } catch (error) {
    errors.push(`Unable to classify guarded paths: ${error.message}`);
  }
  const sha = args.manifest ? "external-manifest" : safeManifestSha(errors);
  writeEvidence({ runRoot, manifest, sha, changedFiles, hits, errors, promotion });
  return { status: errors.length === 0 ? "pass" : "fail", errors };
}
function validateSpecialPromotion({ args, env, manifest, changedFiles, trackerPath, trackerText, base, policyBase }) {
  const headTracker = readFileSync(trackerPath, "utf8");
  const observedFiles = collectSpecialChangedFiles(policyBase);
  const baseSha = resolveCommit(policyBase);
  let bootstrapRecord;
  try {
    bootstrapRecord = JSON.parse(readFileSync(args["bootstrap-record"] || "config/ent-gate-null-promotion-bootstrap.json", "utf8"));
  } catch {}
  const authorityStates = manifest["promotion-mode"] === "authority" ? {
    program: authorityState("docs/plans/current-program.md", policyBase, parseProgramPromotionState),
    enterprise: authorityState("docs/plans/ENTERPRISE_UPGRADE_TRACKER.md", policyBase, parseEnterprisePromotionState),
  } : undefined;
  const promotion = validatePromotionPolicy({
    manifest,
    changedFiles,
    observedFiles,
    baseSha,
    sourceBranch: resolveSourceBranch(env, currentBranch(), githubHeadRepository(env)),
    baseState: parseTrackerPromotionState(trackerText),
    headState: parseTrackerPromotionState(headTracker),
    trackerChanged: trackerText !== headTracker,
    authorityStates,
    regularHeadFiles: collectRegularHeadFiles(changedFiles),
    bootstrapRecord,
  });
  if (resolveCommit(base) !== baseSha) promotion.errors.push("Special promotion diff base must resolve to the policy base commit.");
  return promotion;
}
function authorityState(path, base, parse) {
  return { base: parse(loadTrackerText({ path, base, enforcePromotion: true })), head: parse(readFileSync(path, "utf8")) };
}
function githubHeadRepository(env) {
  if (!env.GITHUB_EVENT_PATH) return "";
  try { return String(JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"))?.pull_request?.head?.repo?.full_name || ""); }
  catch { return ""; }
}
function resolveCommit(ref) {
  const result = spawnSync("git", ["rev-parse", "--verify", `${ref}^{commit}`], { encoding: "utf8", env: cleanGitEnv() });
  return result.status === 0 ? result.stdout.trim() : "";
}
function currentBranch() {
  const result = spawnSync("git", ["branch", "--show-current"], { encoding: "utf8", env: cleanGitEnv() });
  return result.status === 0 ? result.stdout.trim() : "";
}
function baseRefAvailable(base) {
  if (!base || base === "HEAD") return true;
  const result = spawnSync("git", ["rev-parse", "--verify", `${base}^{commit}`], { encoding: "utf8", env: cleanGitEnv() });
  return result.status === 0;
}
function loadTrackerText({ path, base, enforcePromotion }) {
  if (enforcePromotion) {
    if (!base || base === "HEAD") throw new Error(`${path} changed but base tracker is unavailable for promotion validation.`);
    const result = spawnSync("git", ["show", `${base}:${path}`], { encoding: "utf8", env: cleanGitEnv() });
    if (result.status !== 0) throw new Error(`Unable to load base tracker from ${base}:${path}.`);
    return result.stdout;
  }
  return readFileSync(path, "utf8");
}
function safeManifestSha(errors) {
  try {
    return manifestSha("slice-gates.yaml");
  } catch (error) {
    errors.push(`Unable to hash slice-gates.yaml: ${error.message}`);
    return "unavailable";
  }
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = run();
  if (result.status !== "pass") {
    process.stderr.write(`${result.errors.join("\n")}\n`);
    process.exit(1);
  }
}
