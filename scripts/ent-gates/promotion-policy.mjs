import { createHash } from "node:crypto";
export const PROMOTION_MODES = ["authority", "bootstrap"];
export const AUTHORITY_CORE_FILES = [
  "docs/plans/ENTERPRISE_UPGRADE_TRACKER.md",
  "docs/plans/current-program.md",
  "docs/plans/current-tracker.md",
  "slice-gates.yaml",
];
export const BOOTSTRAP_FILES = [
  "config/ent-gate-null-promotion-bootstrap.json",
  "docs/data-lifecycle/nc-eg-06.md",
  "docs/performance/nc-eg-06.md",
  "docs/plans/nc-eg-06-null-promotion-bootstrap-design.md",
  "docs/threat-models/nc-eg-06.md",
  "scripts/__tests__/check-pr-slice-evidence-fragility.test.mjs",
  "scripts/__tests__/check-pr-slice-evidence.test.mjs",
  "scripts/ent-gates/__tests__/ent-gates-tracker.test.mjs",
  "scripts/ent-gates/__tests__/promotion-policy.test.mjs",
  "scripts/ent-gates/check.mjs",
  "scripts/ent-gates/evidence.mjs",
  "scripts/ent-gates/manifest.mjs",
  "scripts/ent-gates/promotion-policy.mjs",
  "scripts/lib/pr-ent-gate-evidence.mjs",
  "slice-gates.yaml",
];
const BOOTSTRAP = { baseSha: "e8b3c5c38650ed3bcc0d64de538cc4247598f49a", branch: "codex/ent-gate-null-promotion-bootstrap", slice: "NC-EG-06" };
export function parseTrackerPromotionState(source) {
  const text = String(source ?? "");
  const headings = [...text.matchAll(/^##\s+Next Slice\s*$/gim)];
  if (headings.length !== 1) return { status: "malformed" };
  const tail = text.slice(headings[0].index + headings[0][0].length);
  const nextHeading = tail.search(/^##\s+/m);
  const section = nextHeading < 0 ? tail : tail.slice(0, nextHeading);
  const targets = [...section.matchAll(/^([A-Z0-9-]+)\s+\/\s+(codex\/[A-Za-z0-9._-]+)(?:\s+\([^\n]*\))?\s*$/gm)]
    .map((match) => ({ slice: match[1], branch: match[2] }));
  const targetOccurrences = [...section.matchAll(/[A-Z0-9-]+\s+\/\s+(codex\/[A-Za-z0-9._-]+)\b/g)];
  const candidates = [...section.matchAll(/^[ \t]*(?:[-*]\s+)?[A-Z0-9-]+\s+\/\s+\S+/gm)];
  const nullMarkers = [...section.matchAll(/^No implementation slice is currently promoted\b/gim)];
  const inlineNullCandidate = /^No implementation slice is currently promoted[^\n]*[A-Z0-9-]+\s+\/\s+\S+/im.test(section);
  if (inlineNullCandidate || candidates.length !== targets.length || targetOccurrences.length !== targets.length) return { status: "malformed" };
  if (targets.length === 1 && nullMarkers.length === 0) return { status: "promoted", target: targets[0] };
  if (targets.length === 0 && nullMarkers.length === 1) return { status: "intentional-null" };
  return { status: "malformed" };
}
export function parseProgramPromotionState(source) {
  const text = String(source ?? "");
  const targets = [...text.matchAll(/^([A-Z0-9-]+)\s+\/\s+(codex\/[A-Za-z0-9._-]+)(?:\s+\([^\n]*\))?\s*$/gm)]
    .map((match) => ({ slice: match[1], branch: match[2] }));
  const occurrences = [...text.matchAll(/[A-Z0-9-]+\s+\/\s+(codex\/[A-Za-z0-9._-]+)\b/g)], candidates = [...text.matchAll(/^[ \t]*(?:[-*]\s+)?[A-Z0-9-]+\s+\/\s+\S+/gm)];
  const nulls = [...text.matchAll(/No\s+implementation slice is currently promoted\./gi)];
  if (candidates.length !== targets.length || occurrences.length !== targets.length) return { status: "malformed" };
  if (targets.length === 1 && nulls.length === 0) return { status: "promoted", target: targets[0] };
  if (targets.length === 0 && nulls.length === 1) return { status: "intentional-null" };
  return { status: "malformed" };
}
export function parseEnterprisePromotionState(source) {
  const rows = [...String(source ?? "").matchAll(/^ {0,3}\|?\s*`([A-Z0-9-]+)`\s*\|\s*`(completed|planned|ready|in_progress|review|blocked)`\s*\|\s*`([A-Za-z0-9._-]+)`\s*\|/gm)];
  if (rows.length === 0) return { status: "malformed" };
  const ready = rows.filter((row) => row[2] === "ready");
  const readyCandidates = [...String(source ?? "").matchAll(/^ {0,3}\|?\s*`?[A-Z0-9-]+`?\s*\|\s*`?ready`?\s*\|/gmi)];
  if (readyCandidates.length !== ready.length) return { status: "malformed" };
  if (ready.length === 0) return { status: "intentional-null" };
  if (ready.length === 1) return { status: "promoted", target: { slice: ready[0][1], branch: `codex/${ready[0][3]}` } };
  return { status: "malformed" };
}
export function resolveSourceBranch(env = {}, gitBranch = "", headRepository = "") {
  const local = String(gitBranch || "").trim();
  const github = String(env.GITHUB_HEAD_REF || "").trim();
  const detachedPullRequest = env.GITHUB_ACTIONS === "true" && Boolean(env.GITHUB_BASE_REF) && Boolean(github);
  if (detachedPullRequest && (!env.GITHUB_REPOSITORY || headRepository !== env.GITHUB_REPOSITORY)) return "";
  if (local) return github && github !== local ? "" : local;
  return detachedPullRequest ? github : "";
}
export function validatePromotionPolicy(input) {
  const mode = input.manifest?.["promotion-mode"] || "standard";
  const errors = [];
  if (!sameSet(input.changedFiles, input.observedFiles)) {
    errors.push("Promotion changed-file enumeration is incomplete or contains surplus paths.");
  }
  if (mode === "authority") validateAuthority(input, errors);
  else if (mode === "bootstrap") validateBootstrap(input, errors);
  else errors.push(`Unsupported special promotion mode: ${mode}.`);
  return { mode, baseSha: input.baseSha || "unresolved", sourceBranch: input.sourceBranch || "unresolved", errors };
}
function validateAuthority(input, errors) {
  if (!input.sourceBranch) errors.push("Authority mode requires a resolved, non-conflicting source branch.");
  else if (input.sourceBranch !== input.manifest.branch) errors.push("Authority source branch does not match the manifest target branch.");
  if (input.baseState?.status !== "intentional-null") errors.push("Authority mode requires an intentional-null base tracker.");
  if (input.headState?.status !== "promoted") errors.push("Authority mode requires exactly one head promotion.");
  if (!input.trackerChanged) errors.push("Authority mode requires the head tracker to change.");
  const target = input.headState?.target;
  if (target && (input.manifest.slice !== target.slice || input.manifest.branch !== target.branch)) {
    errors.push("Authority manifest target does not match the head tracker.");
  }
  for (const name of ["program", "enterprise"]) {
    const state = input.authorityStates?.[name];
    if (state?.base?.status !== "intentional-null") errors.push(`Authority mode requires an intentional-null base ${name} record.`);
    if (state?.head?.status !== "promoted") errors.push(`Authority mode requires exactly one head promotion in the ${name} record.`);
    const recordTarget = state?.head?.target;
    if (recordTarget && (recordTarget.slice !== target?.slice || recordTarget.branch !== target?.branch)) errors.push(`Authority ${name} target does not match the head tracker.`);
  }
  const declared = String(input.manifest?.["authority-files"] || "").split(",").map((file) => file.trim()).filter(Boolean);
  if (declared.length === 0) errors.push("Authority promotion requires explicit design or runbook files.");
  if (new Set(declared).size !== declared.length) errors.push("Authority promotion contains duplicate declared files.");
  for (const file of declared) {
    if (!isSafeDocPath(file, /^docs\/(plans|runbooks)\/[A-Za-z0-9._/-]+\.md$/) || AUTHORITY_CORE_FILES.includes(file)) {
      errors.push(`Authority declared path is not an approved design or runbook: ${file}`);
    }
  }
  const evidence = Object.values(input.manifest?.gates || {}).filter((gate) => gate.status === "required").map((gate) => gate.evidence);
  for (const file of evidence) {
    if (!isSafeDocPath(file, /^docs\/(threat-models|data-lifecycle|performance)\/[A-Za-z0-9._/-]+\.md$/)) {
      errors.push(`Authority evidence path is not allowed: ${file || "missing"}`);
    }
  }
  const allowed = [...AUTHORITY_CORE_FILES, ...declared, ...evidence];
  const regular = new Set(input.regularHeadFiles || []);
  for (const file of allowed) if (!regular.has(file)) errors.push(`Authority path is not a regular head file: ${file}`);
  if (!sameSet(input.changedFiles, allowed)) errors.push("Authority changed files do not match the manifest-bound exact authority set.");
}
function validateBootstrap(input, errors) {
  const record = input.bootstrapRecord;
  if (!record || typeof record !== "object") return errors.push("Bootstrap authorization record is missing.");
  if (record.schemaVersion !== 3 || record.authorizationVersion !== 3 || record.mode !== "one-shot-null-promotion-installer") {
    errors.push("Bootstrap authorization record identity is invalid.");
  }
  for (const key of ["baseSha", "branch", "slice"]) {
    if (record[key] !== BOOTSTRAP[key]) errors.push(`Bootstrap authorization ${key} is invalid.`);
  }
  const recordFiles = Array.isArray(record.allowedFiles) ? record.allowedFiles : [];
  if (recordFiles.length !== BOOTSTRAP_FILES.length || new Set(recordFiles).size !== recordFiles.length || !sameSet(recordFiles, BOOTSTRAP_FILES)) errors.push("Bootstrap authorization file set is invalid.");
  const fileSetHash = createHash("sha256").update(`${[...recordFiles].sort().join("\n")}\n`).digest("hex");
  if (record.fileCount !== recordFiles.length || record.fileCount !== BOOTSTRAP_FILES.length || record.fileSetSha256 !== fileSetHash) errors.push("Bootstrap authorization file-set assertion is invalid.");
  if (input.baseSha !== BOOTSTRAP.baseSha) errors.push("Bootstrap policy base SHA is invalid or expired.");
  if (input.sourceBranch !== BOOTSTRAP.branch) errors.push("Bootstrap source branch is invalid.");
  if (input.manifest.slice !== BOOTSTRAP.slice || input.manifest.branch !== BOOTSTRAP.branch) {
    errors.push("Bootstrap manifest identity is invalid.");
  }
  if (input.baseState?.status !== "intentional-null" || input.headState?.status !== "intentional-null") {
    errors.push("Bootstrap requires intentional-null base and head trackers.");
  }
  if (input.trackerChanged) errors.push("Bootstrap must not change the tracker.");
  const regular = new Set(input.regularHeadFiles || []); for (const file of BOOTSTRAP_FILES) if (!regular.has(file)) errors.push(`Bootstrap path is not a regular head file: ${file}`);
  if (!sameSet(input.changedFiles, BOOTSTRAP_FILES)) errors.push("Bootstrap changed files do not match the one-shot set.");
}
function isSafeDocPath(file, pattern) { return typeof file === "string" && pattern.test(file) && file.split("/").every((part) => part && part !== "." && part !== ".."); }
function sameSet(left = [], right = []) { const a = [...new Set(left)].sort(), b = [...new Set(right)].sort(); return a.length === b.length && a.every((value, index) => value === b[index]); }
