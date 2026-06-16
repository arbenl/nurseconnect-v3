import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
export const scriptPath = join(repoRoot, "scripts/multi-agent/slice-evidence.mjs");
export const requiredReviewers = ["sonnet46", "gemini"];

export function makeRoot() {
  return mkdtempSync(join(tmpdir(), "nurseconnect-slice-evidence-"));
}

export function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

export function runSliceEvidence(root, args = []) {
  return spawnSync("node", [scriptPath, "--run-root", root, ...args], { cwd: repoRoot, encoding: "utf8" });
}

export function writeRunRoot(root, overrides = {}) {
  mkdirSync(join(root, "evidence"), { recursive: true });
  mkdirSync(join(root, "reviews"), { recursive: true });
  mkdirSync(join(root, "reviews/subagents"), { recursive: true });
  writeFileSync(join(root, "run-manifest.md"), "# Manifest\n");
  writeFileSync(join(root, "reviewer-plan.md"), "# Reviewer Plan\n");
  writeFileSync(join(root, "reviews/subagents/security_reviewer.md"), "# Security Reviewer\n");
  writeFileSync(join(root, "reviews/codex-senior-review.md"), "# Codex Senior Review\n");
  writeFileSync(join(root, "reviews/codex-senior-review.json"), json(overrides.codexSeniorReview ?? {
    status: "pass",
    reviewer: "codex-senior",
    baseSha: "base",
    headSha: "head",
    changedFiles: ["scripts/example.mjs"],
    receiptPath: "reviews/codex-senior-review.md",
    mustFixCount: 0,
    mustFixDisposition: "none",
  }));
  writeFileSync(join(root, "reviews/subagent-handoff.json"), json(overrides.subagentHandoff ?? {
    status: "pass",
    reviewers: [{ reviewer: "security_reviewer", prompt: join(root, "prompts/security_reviewer.md") }],
    missingPrompts: [],
  }));
  writeFileSync(join(root, "reviews/subagent-results.json"), json(overrides.subagentResults ?? {
    status: "pass",
    selectedReviewers: ["security_reviewer"],
    results: [{ reviewer: "security_reviewer", status: "complete", receiptPath: "reviews/subagents/security_reviewer.md", verdict: "READY FOR PR", mustFixCount: 0 }],
    unresolvedMustFixCount: 0,
    mustFixDisposition: "none",
  }));
  writeFileSync(join(root, "evidence/nurseconnect-qa.json"), json(overrides.qa ?? {
    status: "success",
    mcpIdentity: {
      canonical: "nurseconnect_qa",
      requested: "nurseconnect_qa",
      effective: "nurseconnect_qa",
      aliases: ["nurse_qa"],
      owned: ["nurseconnect_qa", "nurse_qa"],
      forbidden: ["interdomestik_qa"],
      configured: ["context7", "nurse_qa", "nurseconnect_qa", "playwright"],
    },
    availableTools: ["branch_status", "modularity_audit", "project_map", "scope_audit", "slice_evidence_audit"],
    branchStatus: { changedFileCount: 2 },
    modularityAudit: { status: "success" },
  }));
  writeFileSync(join(root, "evidence/model-review.json"), json(overrides.modelReview ?? {
    status: "complete",
    completed: ["claude"],
    dryRun: [],
    blocked: [],
    debate: true,
  }));
  if (overrides.preflight) writeFileSync(join(root, "reviews/model-review-preflight.json"), json(overrides.preflight));
  if (overrides.access) writeFileSync(join(root, "reviews/model-review-access.json"), json(overrides.access));
}

export function passPreflight(reviewers = requiredReviewers) {
  return { status: "pass", reviewers, results: reviewers.map((reviewer) => ({ reviewer, status: "available" })) };
}

export function passAccess(reviewers = requiredReviewers) {
  return { status: "pass", reviewers, completed: reviewers, blocked: [] };
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
