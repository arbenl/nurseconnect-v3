import { createHash } from "node:crypto";
export const REPAIR_BASE = "9882c8b5044d238c398dde8e0ec45b7bf039cc89";
export const REPAIR_BRANCH = "codex/governance-fixture-repair";
export const REPAIR_SLICE = "NC-EG-09";
export const REPAIR_FILES = [
  ".github/CODEOWNERS",
  ".github/workflows/ci.yml",
  "config/nc-governance-fixture-repair.json",
  "config/nurseconnect-sentry-target.json",
  "docs/data-lifecycle/nc-gov-repair-01.md",
  "docs/performance/nc-gov-repair-01.md",
  "docs/plans/nc-gov-repair-01-design.md",
  "docs/threat-models/nc-gov-repair-01.md",
  "scripts/ent-gates/__tests__/bootstrap-fixture.mjs",
  "scripts/ent-gates/__tests__/ent-gates-structural-checkout.test.mjs",
  "scripts/ent-gates/__tests__/ent-gates-tracker.test.mjs",
  "scripts/ent-gates/__tests__/root-repair-policy.test.mjs",
  "scripts/ent-gates/__tests__/root-repair-context.test.mjs",
  "scripts/ent-gates/check.mjs",
  "scripts/ent-gates/manifest.mjs",
  "scripts/ent-gates/promotion-policy.mjs",
  "scripts/ent-gates/root-repair-context.mjs",
  "scripts/ent-gates/root-repair-policy.mjs",
  "scripts/multi-agent/__tests__/codex-senior-review-result.test.mjs",
  "scripts/multi-agent/__tests__/trusted-sentry-collector.test.mjs",
  "scripts/multi-agent/codex-senior-review.mjs",
  "scripts/multi-agent/lib/senior-review-result.mjs",
  "scripts/multi-agent/trusted-sentry-collector.mjs",
  "slice-gates.yaml",
];
const exact = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length
  && new Set(a).size === a.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);
export function fileSetHash(files) {
  return createHash("sha256").update(`${[...files].sort().join("\n")}\n`).digest("hex");
}
export function validateRootRepair(input, errors) {
  const record = input.repairRecord;
  const expectedKeys = ["schemaVersion", "mode", "baseSha", "branch", "slice", "allowedFiles", "fileCount", "fileSetSha256"];
  if (!record || !exact(Object.keys(record), expectedKeys)) return errors.push("Root repair record schema is invalid.");
  if (record.schemaVersion !== 1 || record.mode !== "reviewed-governance-repair"
    || record.baseSha !== REPAIR_BASE || record.branch !== REPAIR_BRANCH || record.slice !== REPAIR_SLICE
    || !exact(record.allowedFiles, REPAIR_FILES) || record.fileCount !== REPAIR_FILES.length
    || record.fileSetSha256 !== fileSetHash(REPAIR_FILES)) errors.push("Root repair record identity or inventory is invalid.");
  if (input.baseSha !== REPAIR_BASE || input.repairContext?.mainSha !== REPAIR_BASE) errors.push("Root repair fixed base is invalid or expired.");
  if (input.sourceBranch !== REPAIR_BRANCH || input.manifest.branch !== REPAIR_BRANCH
    || input.manifest.slice !== REPAIR_SLICE) errors.push("Root repair branch or slice is invalid.");
  if (input.baseState?.status !== "intentional-null" || input.headState?.status !== "intentional-null"
    || input.trackerChanged) errors.push("Root repair must preserve intentional-null trackers.");
  for (const name of ["program", "enterprise"]) {
    const states = input.authorityStates?.[name];
    if (states?.base?.status !== "intentional-null" || states?.head?.status !== "intentional-null") {
      errors.push(`Root repair must preserve intentional-null ${name} records.`);
    }
  }
  if (!exact(input.changedFiles, REPAIR_FILES) || !exact(input.observedFiles, REPAIR_FILES)
    || !exact(input.regularHeadFiles, REPAIR_FILES)) errors.push("Root repair requires its exact regular-file inventory.");
  const evidence = { "ent-tm": "docs/threat-models/nc-gov-repair-01.md", "ent-dlv": "docs/data-lifecycle/nc-gov-repair-01.md", "ent-perf": "docs/performance/nc-gov-repair-01.md" };
  for (const [gate, path] of Object.entries(evidence)) {
    if (input.manifest.gates?.[gate]?.status !== "required" || input.manifest.gates[gate].evidence !== path) errors.push(`Root repair requires bound ${gate} evidence.`);
  }
  errors.push(...(input.repairContext?.errors || []));
  if (!input.repairContext) errors.push("Root repair context is unavailable.");
}
