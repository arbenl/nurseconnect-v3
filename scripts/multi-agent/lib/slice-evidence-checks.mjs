import { existsSync } from "node:fs";
import path from "node:path";

import { checkFile, fail, missingRequired, pass, readJson, validMustFixDisposition } from "./slice-evidence-shared.mjs";

export async function checkNurseConnectQa(runRoot) {
  const file = path.join(runRoot, "evidence", "nurseconnect-qa.json");
  const fileCheck = checkFile("nurseconnect_qa evidence", file);
  if (fileCheck.status === "fail") return fileCheck;
  const evidence = await readJson(file);
  if (evidence.status !== "success") return fail("nurseconnect_qa evidence did not pass", { path: file, evidenceStatus: evidence.status, blocker: evidence.blocker || null });
  const availableTools = Array.isArray(evidence.availableTools) ? evidence.availableTools : [];
  const requiredTools = ["project_map", "branch_status", "scope_audit", "modularity_audit", "slice_evidence_audit"];
  const missingTools = requiredTools.filter((tool) => !availableTools.includes(tool));
  if (missingTools.length > 0) return fail("nurseconnect_qa evidence is missing required tools", { path: file, missingTools });
  const missingIdentity = missingMcpIdentity(evidence.mcpIdentity);
  if (missingIdentity.length > 0) return fail("nurseconnect_qa MCP identity evidence is incomplete", { path: file, missingIdentity });
  if (evidence.modularityAudit?.status !== "success") return fail("nurseconnect_qa modularity audit did not pass", { path: file, modularityStatus: evidence.modularityAudit?.status ?? "missing" });
  return pass("nurseconnect_qa evidence passed", { path: file, changedFileCount: evidence.branchStatus?.changedFileCount ?? evidence.scopeAudit?.changedFileCount ?? null });
}

function missingMcpIdentity(identity = {}) {
  const aliases = Array.isArray(identity.aliases) ? identity.aliases : [];
  const configured = Array.isArray(identity.configured) ? identity.configured : [];
  const forbidden = Array.isArray(identity.forbidden) ? identity.forbidden : [];
  const owned = Array.isArray(identity.owned) ? identity.owned : [];
  const missing = [];
  if (identity.canonical !== "nurseconnect_qa") missing.push("canonical:nurseconnect_qa");
  if (identity.effective !== "nurseconnect_qa") missing.push("effective:nurseconnect_qa");
  if (!aliases.includes("nurse_qa")) missing.push("alias:nurse_qa");
  for (const name of ["nurseconnect_qa", "nurse_qa"]) {
    if (!owned.includes(name)) missing.push(`owned:${name}`);
    if (!configured.includes(name)) missing.push(`configured:${name}`);
  }
  if (!forbidden.includes("interdomestik_qa")) missing.push("forbidden:interdomestik_qa");
  if (forbidden.includes(identity.requested)) missing.push(`requested-forbidden:${identity.requested}`);
  if (configured.includes("interdomestik_qa")) missing.push("configured-forbidden:interdomestik_qa");
  return missing;
}

export async function checkSubagentHandoff(runRoot) {
  const file = path.join(runRoot, "reviews", "subagent-handoff.json");
  const fileCheck = checkFile("subagent reviewer handoff", file);
  if (fileCheck.status === "fail") return fileCheck;
  const evidence = await readJson(file);
  if (evidence.status !== "pass") return fail("subagent reviewer handoff did not pass", { path: file, evidenceStatus: evidence.status, missingPrompts: evidence.missingPrompts || [] });
  if (!Array.isArray(evidence.reviewers) || evidence.reviewers.length === 0) return fail("subagent reviewer handoff has no reviewers", { path: file });
  return pass("subagent reviewer handoff passed", { path: file, reviewers: evidence.reviewers.map((item) => item.reviewer) });
}

export async function checkSubagentResults(runRoot, options) {
  const file = path.join(runRoot, "reviews", "subagent-results.json");
  const fileCheck = checkFile("subagent reviewer results", file);
  if (fileCheck.status === "fail") return options.requireSubagentResults ? fileCheck : pass("subagent reviewer results not required", { path: file });
  const evidence = await readJson(file);
  const handoffFile = path.join(runRoot, "reviews", "subagent-handoff.json");
  const handoff = existsSync(handoffFile) ? await readJson(handoffFile) : { reviewers: [] };
  const expected = (Array.isArray(handoff.reviewers) ? handoff.reviewers : []).map((item) => item.reviewer).filter(Boolean);
  const selected = Array.isArray(evidence.selectedReviewers) ? evidence.selectedReviewers : [];
  const required = expected.length > 0 ? expected : selected;
  const results = Array.isArray(evidence.results) ? evidence.results : [];
  const incomplete = results.filter((item) => item.status !== "complete").map((item) => item.reviewer);
  const completed = new Set(results.filter((item) => item.status === "complete").map((item) => item.reviewer));
  const missing = required.filter((reviewer) => !completed.has(reviewer));
  const validVerdicts = new Set(["READY FOR PR", "READY FOR PR AFTER MUST-FIX ITEMS", "NOT READY FOR PR"]);
  const invalidVerdicts = results.filter((item) => !validVerdicts.has(item.verdict)).map((item) => item.reviewer);
  const blockingVerdicts = results.filter((item) => item.verdict !== "READY FOR PR").map((item) => item.reviewer);
  const missingReceipts = results.filter((item) => !receiptExists(runRoot, item.receiptPath)).map((item) => item.reviewer);
  const unresolved = Number(evidence.unresolvedMustFixCount || 0);
  if (evidence.status !== "pass" || incomplete.length > 0 || missing.length > 0 || invalidVerdicts.length > 0 || blockingVerdicts.length > 0 || missingReceipts.length > 0) {
    return fail("subagent reviewer results did not pass", { path: file, evidenceStatus: evidence.status, expected, selected, incomplete, missing, invalidVerdicts, blockingVerdicts, missingReceipts });
  }
  if (unresolved > 0 && !validMustFixDisposition(options.mustFixDisposition, unresolved)) {
    return fail("subagent reviewer MUST_FIX candidates require explicit fixed or rejected disposition", { path: file, unresolvedMustFixCount: unresolved, mustFixDisposition: options.mustFixDisposition || "" });
  }
  return pass("subagent reviewer results passed", { path: file, reviewers: results.map((item) => item.reviewer), unresolvedMustFixCount: unresolved });
}

function receiptExists(runRoot, receiptPath) {
  if (!receiptPath) return false;
  const resolved = path.isAbsolute(receiptPath) ? receiptPath : path.join(runRoot, receiptPath);
  return existsSync(resolved);
}

export async function checkModelReview(runRoot, options) {
  const file = path.join(runRoot, "evidence", "model-review.json");
  const fileCheck = checkFile("model-review evidence", file);
  if (fileCheck.status === "fail") return fileCheck;
  const evidence = await readJson(file);
  const completed = Array.isArray(evidence.completed) ? evidence.completed : [];
  const dryRun = Array.isArray(evidence.dryRun) ? evidence.dryRun : [];
  const blocked = Array.isArray(evidence.blocked) ? evidence.blocked : [];
  const reviewers = Array.isArray(evidence.reviewers) ? evidence.reviewers : [];
  const acceptableReviewers = [...completed, ...(options.allowDryRun ? dryRun : [])];
  const agreedMustFixCount = Number.isFinite(Number(evidence.agreedMustFixCount)) ? Number(evidence.agreedMustFixCount) : 0;
  const blockedRequired = blocked.filter((reviewer) => options.requiredReviewers.includes(reviewer));
  if (blockedRequired.length > 0) return fail("model-review has blocked required reviewer routes", { path: file, blocked: blockedRequired });
  if (options.requireModelReview && acceptableReviewers.length === 0) {
    return fail("required model-review receipts are missing", { path: file, evidenceStatus: evidence.status || "unknown", completed, dryRun, allowDryRun: options.allowDryRun });
  }
  if (options.requiredReviewers.length > 0) {
    const missing = missingRequired(acceptableReviewers, options.requiredReviewers);
    if (missing.length > 0) return fail("model-review evidence is missing required reviewer receipts", { path: file, requiredReviewers: options.requiredReviewers, reviewers, acceptableReviewers, missingReviewers: missing, allowDryRun: options.allowDryRun });
  }
  if (options.requireDebate && evidence.debate !== true) return fail("required model-review debate evidence is missing", { path: file, evidenceStatus: evidence.status || "unknown" });
  if (!validMustFixDisposition(options.mustFixDisposition, agreedMustFixCount)) {
    return fail("model-review MUST_FIX candidates require explicit fixed or rejected disposition", { path: file, agreedMustFixCount, mustFixDisposition: options.mustFixDisposition || "" });
  }
  return pass(blocked.length > 0 ? "model-review evidence passed with blocked optional routes" : "model-review evidence passed", { path: file, evidenceStatus: evidence.status || "unknown", completed, blocked, dryRun, debate: Boolean(evidence.debate), agreedMustFixCount, mustFixDisposition: options.mustFixDisposition || (agreedMustFixCount === 0 ? "none" : "") });
}

export async function checkModelPreflight(runRoot, options) {
  const file = path.join(runRoot, "reviews", "model-review-preflight.json");
  const fileCheck = checkFile("model-review preflight evidence", file);
  if (fileCheck.status === "fail") return options.requireModelPreflight || options.requiredReviewers.length > 0 ? fileCheck : pass("model-review preflight evidence not required", { path: file });
  const evidence = await readJson(file);
  const results = Array.isArray(evidence.results) ? evidence.results : [];
  const available = results.filter((result) => result.status === "available").map((result) => result.reviewer);
  const blocked = results.filter((result) => result.status === "blocked").map((result) => result.reviewer);
  const blockedRequired = options.requiredReviewers.length > 0 ? blocked.filter((reviewer) => options.requiredReviewers.includes(reviewer)) : blocked;
  if ((blockedRequired.length > 0 || (evidence.status === "blocked" && options.requiredReviewers.length === 0)) && (options.requireModelPreflight || options.requiredReviewers.length > 0)) return fail("model-review preflight has blocked reviewer routes", { path: file, blocked: blockedRequired });
  if (options.requiredReviewers.length > 0) {
    const missing = missingRequired(available, options.requiredReviewers);
    if (missing.length > 0) return fail("model-review preflight is missing required available routes", { path: file, requiredReviewers: options.requiredReviewers, availableReviewers: available, missingReviewers: missing });
  }
  return pass("model-review preflight evidence passed", { path: file, evidenceStatus: evidence.status || "unknown", reviewers: Array.isArray(evidence.reviewers) ? evidence.reviewers : [] });
}

export async function checkModelAccess(runRoot, options) {
  const file = path.join(runRoot, "reviews", "model-review-access.json");
  const fileCheck = checkFile("model-review access-check evidence", file);
  if (fileCheck.status === "fail") return options.requireModelAccess ? fileCheck : pass("model-review access-check evidence not required", { path: file });
  const evidence = await readJson(file);
  const completed = Array.isArray(evidence.completed) ? evidence.completed : [];
  const blockedItems = Array.isArray(evidence.blocked) ? evidence.blocked : [];
  const blocked = blockedItems.map((result) => result.reviewer);
  const blockedRequired = options.requiredReviewers.length > 0 ? blocked.filter((reviewer) => options.requiredReviewers.includes(reviewer)) : blocked;
  if (blockedRequired.length > 0 || (evidence.status === "blocked" && options.requiredReviewers.length === 0)) {
    if (!options.requireModelAccess && options.requiredReviewers.length === 0) return pass("model-review access-check recorded blocked optional routes", { path: file, blocked, remediation: blockedItems.map((item) => item.remediation).filter(Boolean) });
    return fail("model-review access-check has blocked reviewer routes", { path: file, blocked: blockedRequired, remediation: blockedItems.map((item) => item.remediation).filter(Boolean) });
  }
  if (options.requiredReviewers.length > 0) {
    const missing = missingRequired(completed, options.requiredReviewers);
    if (missing.length > 0) return fail("model-review access-check is missing required completed routes", { path: file, requiredReviewers: options.requiredReviewers, completedReviewers: completed, missingReviewers: missing });
  }
  return pass("model-review access-check evidence passed", { path: file, evidenceStatus: evidence.status || "unknown", completed });
}
