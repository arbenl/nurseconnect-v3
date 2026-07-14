import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { classifyChangedFiles, loadGatePaths, validateGuardedOverrides } from "../ent-gates/diff-classifier.mjs";
import { loadManifest, validateManifest } from "../ent-gates/manifest.mjs";

export function validateEntGateEvidence(errors, evidence, manifestPath = "slice-gates.yaml", files = [], options = {}) {
  const env = options.env || process.env;
  const text = String(evidence || "");
  if (!/\bent-gates\s*:\s*PASS\b/i.test(text)) errors.push("Evidence section missing ent-gates PASS.");
  if (!/evidence\/ent-gates\.(md|json)/i.test(text)) errors.push("Evidence section missing ent-gates evidence path.");

  const cited = text.match(/\bmanifest\s+sha(?:256)?\s*:\s*`?([a-f0-9]{64})`?/i)?.[1];
  if (!cited) return errors.push("Evidence section missing slice-gates manifest sha256.");
  if (!existsSync(manifestPath)) return errors.push(`Unable to read gate manifest for sha validation: ${manifestPath}`);

  const actual = createHash("sha256").update(readFileSync(manifestPath)).digest("hex");
  if (cited !== actual) errors.push(`slice-gates manifest sha mismatch: cited ${cited}, actual ${actual}.`);
  const base = env.BASE_COMMIT || env.GATE_POLICY_BASE || "";
  if (!base && isCiContext(env)) return errors.push("Ent-gate checkout verification requires BASE_COMMIT in CI/PR context.");
  if (!base) return validateStructuralCheckout(errors, manifestPath, files, env, options.configPath);
  const args = [
    "scripts/ent-gates/check.mjs",
    "--run-root",
    "tmp/multi-agent/pr-finalizer-ent-gates",
    "--base",
    base,
    "--policy-base",
    env.GATE_POLICY_BASE || base,
    "--enforce-promotion",
    "true",
  ];
  if (env.PR_FILES_COMPLETE === "1") args.push("--changed-files-complete");
  for (const file of files) args.push("--changed-file", file);
  const check = (options.spawn || spawnSync)("node", args, { encoding: "utf8" });
  if (check.status !== 0) errors.push(`ent-gates checkout verification failed:\n${check.stdout || ""}${check.stderr || ""}`.trim());
}

function validateStructuralCheckout(errors, manifestPath, files, env, configPath) {
  if (env.PR_FILES_COMPLETE !== "1") return errors.push("Structural checkout-evidence validation requires a declared complete file list.");
  const loaded = loadManifest(manifestPath);
  errors.push(...loaded.errors, ...validateManifest({ manifest: loaded.manifest, changedFiles: files, enforcePromotion: false, enforceDiffEvidence: true }));
  try {
    const hits = classifyChangedFiles(files, loadGatePaths(configPath || "config/ent-gate-paths.json"));
    errors.push(...validateGuardedOverrides(loaded.manifest, hits));
  } catch (error) {
    errors.push(`Unable to structurally classify checkout evidence: ${error.message}`);
  }
}

function isCiContext(env) {
  const ci = String(env.CI || "").trim().toLowerCase();
  return (Boolean(ci) && !["0", "false", "no"].includes(ci)) || env.GITHUB_ACTIONS === "true" || Boolean(env.GITHUB_BASE_REF) || Boolean(env.GITHUB_HEAD_REF) || env.GITHUB_EVENT_NAME === "pull_request";
}
