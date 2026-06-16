import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const requiredModelReviewers = ["sonnet46", "gemini"];
const protectedPatterns = [/^apps\/web\/src\/app\/api\/auth\//, /^apps\/web\/src\/app\/.*\/route\.ts$/, /^apps\/web\/src\/middleware\.ts$/, /\/proxy\//, /^packages\/contracts\//, /^apps\/contracts\//, /^contracts\//, /^packages\/database\//, /^\.github\/workflows\//, /^scripts\/(multi-agent|mcp|lib\/pr-slice-evidence|pr-finalizer|check-pr-slice-evidence|check-modularity-guard)/, /^package\.json$/, /auth|session|webhook|payment|payout|admin|PHI|phi|secret/i];

function extractSection(markdown, heading) {
  const lines = String(markdown || "").split(/\r?\n/);
  const titleRegex = new RegExp(`^#{2,6}\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
  let start = -1;
  let startLevel = 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (titleRegex.test(lines[index])) {
      start = index + 1;
      startLevel = (lines[index].match(/^#+/)?.[0] || "").length;
      break;
    }
  }
  if (start < 0) return "";
  const out = [];
  for (let index = start; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{2,6})\s+/);
    if (match && match[1].length <= startLevel) break;
    out.push(lines[index]);
  }
  return out.join("\n").trim();
}

function parseTier(body) {
  const match = String(body || "").match(/\b(?:tier|risk tier)\s*[:=-]?\s*([0-3])\b/i);
  return match ? Number(match[1]) : null;
}

function isHighRisk(body, files) {
  const tier = parseTier(body);
  return (tier !== null && tier >= 2) || files.some((file) => protectedPatterns.some((pattern) => pattern.test(file)));
}

function mustFixDisposition(text) {
  const match = String(text || "").match(/MUST_FIX\s*:\s*(\d+)\s*\(([^)]+)\)/i);
  return match ? { count: Number(match[1]), disposition: match[2].trim() } : null;
}

function hasStrictCommand(evidence) {
  const required = ["--require-reviewers", "--require-model-preflight", "--require-model-access", "--require-model-review", "--require-subagent-results", "--require-codex-senior-review", "--require-debate", "--must-fix-disposition"];
  const text = String(evidence || "");
  return required.every((flag) => new RegExp(flag, "i").test(text)) && reviewerListMatchesStrict(text);
}

function reviewerListMatchesStrict(text) {
  const reviewerFlag = /--require-reviewers(?:=|\s+)(?:"([^"]+)"|'([^']+)'|`([^`]+)`|([^\s`]+))/gi;
  for (const match of text.matchAll(reviewerFlag)) {
    const reviewers = (match[1] || match[2] || match[3] || match[4] || "").split(",").map((item) => item.trim()).filter(Boolean);
    if (reviewers.length === requiredModelReviewers.length && requiredModelReviewers.every((reviewer) => reviewers.includes(reviewer))) return true;
  }
  return false;
}

function hasBlockedExternalDisposition(evidence) {
  return /model (?:route |review |access |debate )?(?:blocked|skipped)|external reviewer(?:s)? blocked|not counted as approval|no approval counted/i.test(String(evidence || ""));
}

function hasEvidence(evidence, pattern, labelPattern = pattern) {
  const text = String(evidence || "");
  return pattern.test(text) || labelPattern.test(text);
}

function extractRunRoot(evidence) {
  const match = String(evidence || "").match(/\btmp\/multi-agent\/verify-slice\/[A-Za-z0-9._/-]+/);
  return match ? match[0].replace(/[/.]*$/, "") : "";
}

function requireEvidence(errors, evidence) {
  for (const [label, pattern, labelPattern] of [
    ["verify-slice run root", /tmp\/multi-agent\/verify-slice\/[A-Za-z0-9._/-]+/],
    ["reviewer plan", /reviewer-plan\.md/],
    ["nurseconnect_qa evidence", /evidence\/nurseconnect-qa\.(md|json)/, /nurseconnect[_ -]?qa evidence/i],
    ["subagent handoff", /reviews\/subagent-handoff\.(md|json)/, /subagent handoff/i],
    ["model-review evidence", /evidence\/model-review\.(md|json)/, /model[- ]review evidence/i],
    ["plugin activation", /plugin activation|plugin_activation_policy/i],
    ["modularity guard", /pnpm\s+modularity:guard|modularity-guard/],
    ["slice evidence check", /pnpm\s+slice:evidence|slice-evidence/, /slice evidence/i],
    ["verify-slice static gate", /verify-slice[^\n`]*--static|--static[^\n`]*verify-slice/],
    ["verify-slice required gates", /verify-slice[^\n`]*--required-gates|--required-gates[^\n`]*verify-slice/, /strict release gate|pre-push[^\n]*(?:gate|release)/i],
  ]) {
    if (!hasEvidence(evidence, pattern, labelPattern)) errors.push(`Evidence section missing ${label}.`);
  }
}

function checkDisposition(errors, evidence) {
  const disposition = mustFixDisposition(evidence);
  if (!disposition || !/^(all fixed|rejected\s*:\s*.+|none)$/i.test(disposition.disposition)) errors.push('Evidence section must include MUST_FIX disposition like "MUST_FIX: 0 (none)" or "MUST_FIX: 2 (all fixed)".');
  else if (disposition.count > 0 && /^none$/i.test(disposition.disposition)) errors.push('Evidence section cannot use "none" disposition when MUST_FIX count is greater than 0.');
  else if (disposition.count === 0 && !/^none$/i.test(disposition.disposition)) errors.push('Evidence section should use "MUST_FIX: 0 (none)" when there are no MUST_FIX findings.');
  return disposition;
}

function checkHighRisk(errors, evidence) {
  if (/--allow-dry-run/i.test(evidence)) errors.push("Tier 2/3 or protected-file PRs must not use --allow-dry-run in strict slice:evidence evidence.");
  if (!hasEvidence(evidence, /reviews\/model-review-preflight\.(md|json)/i, /model route preflight/i)) errors.push("Tier 2/3 or protected-file PRs must include model route preflight evidence.");
  if (!hasEvidence(evidence, /reviews\/model-review-access\.(md|json)/i, /model (?:access check|route access)/i)) errors.push("Tier 2/3 or protected-file PRs must include model route access-check evidence.");
  if (!hasEvidence(evidence, /evidence\/model-review\.(md|json)/i, /model[- ]review evidence/i)) errors.push("Tier 2/3 or protected-file PRs must include model-review receipt evidence.");
  if (!hasEvidence(evidence, /reviews\/codex-senior-review\.(md|json)/i, /codex senior review/i)) errors.push("Tier 2/3 or protected-file PRs must include Codex senior review receipt evidence.");
  if (hasStrictCommand(evidence)) {
    if (!/reviews\/subagent-results\.(md|json)/i.test(evidence)) errors.push("Strict Tier 2/3 or protected-file PR evidence must include subagent reviewer result evidence.");
    if (!/reviews\/debate\.(md|json)/i.test(evidence)) errors.push("Strict Tier 2/3 or protected-file PR evidence must include model debate receipt evidence.");
  } else if (!hasBlockedExternalDisposition(evidence)) {
    errors.push("Tier 2/3 or protected-file PRs must include either strict live reviewer slice:evidence or an explicit blocked external-review disposition that says blocked routes were not counted as approval.");
  }
}

export function validatePrSliceEvidence({ body, files = [] }) {
  const errors = [];
  const evidence = extractSection(body, "Evidence");
  const highRisk = isHighRisk(body, files);
  if (!/\bNC-(?:E\d+|EG|TB|CQ)-\d+\b/.test(body)) errors.push("PR body must include a NurseConnect tracker ID like NC-E2-03 or NC-EG-00.");
  if (!evidence) return { status: "fail", highRisk, errors: [...errors, 'PR body missing required "Evidence" section.'] };
  requireEvidence(errors, evidence);
  checkDisposition(errors, evidence);
  if (highRisk) checkHighRisk(errors, evidence);
  return { status: errors.length > 0 ? "fail" : "pass", highRisk, errors };
}

export function verifyReferencedRunRoot({ body, files = [], allowMissing = false }) {
  const evidence = extractSection(body, "Evidence");
  const highRisk = isHighRisk(body, files);
  const runRoot = extractRunRoot(evidence);
  const disposition = mustFixDisposition(evidence);
  const errors = [];
  if (!runRoot) return { status: "fail", highRisk, runRoot, skipped: false, errors: ["Unable to find verify-slice run root in Evidence section."] };
  if (!existsSync(runRoot)) {
    const errors = allowMissing ? [] : [`Referenced verify-slice run root does not exist locally: ${runRoot}`];
    return { status: allowMissing ? "pass" : "fail", highRisk, runRoot, skipped: allowMissing, reason: "run root is not present in this checkout", errors };
  }
  const args = ["slice:evidence", "--", "--run-root", runRoot];
  if (highRisk && !hasBlockedModelAccess(runRoot)) args.push("--require-reviewers", requiredModelReviewers.join(","), "--require-model-preflight", "--require-model-access", "--require-model-review", "--require-subagent-results", "--require-debate", "--must-fix-disposition", disposition?.disposition || "");
  const result = spawnSync("pnpm", args, { encoding: "utf8" });
  if (result.status !== 0) errors.push(`Referenced run root failed slice:evidence verification:\n${result.stdout || ""}${result.stderr || ""}`.trim());
  return { status: errors.length > 0 ? "fail" : "pass", highRisk, runRoot, skipped: false, command: ["pnpm", ...args].join(" "), errors };
}

function hasBlockedModelAccess(runRoot) {
  const file = `${runRoot}/reviews/model-review-access.json`;
  if (!existsSync(file)) return false;
  const evidence = JSON.parse(readFileSync(file, "utf8"));
  return evidence.status === "blocked" || (Array.isArray(evidence.blocked) && evidence.blocked.length > 0);
}
