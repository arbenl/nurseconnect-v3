import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadManifest } from "../ent-gates/manifest.mjs";

export const requiredReviewers = ["sonnet46", "gemini"];
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const manifestPath = join(repoRoot, "slice-gates.yaml");
export const manifestSha = createHash("sha256")
  .update(readFileSync(manifestPath))
  .digest("hex");
const gateEvidenceFiles = Object.values(loadManifest(manifestPath).manifest?.gates || {})
  .map((gate) => gate.evidence)
  .filter(Boolean);
export const entGateFiles = [...new Set(["docs/runbooks/slice_workflow.md", ...gateEvidenceFiles])];

export const goodEvidence = `
## Summary
- NC-E2-03 platform authz slice, Tier 3.

## Evidence
### Verify Slice
- [x] Run root used for reviewer plan and gate logs: \`tmp/multi-agent/verify-slice/verify-slice-20260605T080944Z-fe7eee/\`
- [x] Reviewer plan: \`tmp/multi-agent/verify-slice/verify-slice-20260605T080944Z-fe7eee/reviewer-plan.md\`
- [x] Subagent handoff: \`tmp/multi-agent/verify-slice/verify-slice-20260605T080944Z-fe7eee/reviews/subagent-handoff.md\`
- [x] Subagent results: \`tmp/multi-agent/verify-slice/verify-slice-20260605T080944Z-fe7eee/reviews/subagent-results.md\`
- [x] Model route preflight: \`tmp/multi-agent/verify-slice/verify-slice-20260605T080944Z-fe7eee/reviews/model-review-preflight.md\`
- [x] Model access check: \`tmp/multi-agent/verify-slice/verify-slice-20260605T080944Z-fe7eee/reviews/model-review-access.md\`
- [x] Codex senior review: \`tmp/multi-agent/verify-slice/verify-slice-20260605T080944Z-fe7eee/reviews/codex-senior-review.md\`
- [x] Plugin activation: \`docs/runbooks/plugin_activation_policy.md\` applied; activated plugins: GitHub, Codex Security
- [x] NurseConnect QA evidence: \`tmp/multi-agent/verify-slice/verify-slice-20260605T080944Z-fe7eee/evidence/nurseconnect-qa.md\`
- [x] Model review evidence: \`tmp/multi-agent/verify-slice/verify-slice-20260605T080944Z-fe7eee/evidence/model-review.md\`
- [x] Model debate: \`tmp/multi-agent/verify-slice/verify-slice-20260605T080944Z-fe7eee/reviews/debate.md\`
- [x] ent-gates: PASS @ \`tmp/multi-agent/verify-slice/verify-slice-20260605T080944Z-fe7eee/evidence/ent-gates.md\`
- [x] manifest sha256: \`${manifestSha}\`
- [x] MUST_FIX: 0 (none)
- [x] \`pnpm modularity:guard -- --base <base-commit>\` result: pass
- [x] \`pnpm verify-slice -- --run-root <run-root> --static\` result: pass
- [x] \`pnpm verify-slice -- --run-root <run-root> --required-gates\` result: pass
- [x] \`pnpm slice:evidence -- --run-root <run-root>\` result: pass
- [x] \`pnpm slice:evidence -- --run-root <run-root> --require-reviewers "sonnet46,gemini" --require-model-preflight --require-model-access --require-model-review --require-subagent-results --require-codex-senior-review --require-debate --must-fix-disposition "none"\` result: pass

### Logs
- [x] Logs path: \`tmp/multi-agent/verify-slice/verify-slice-20260605T080944Z-fe7eee/evidence/gates/\`

### Screenshots
- [x] Screenshot path: \`N/A\`

### Runbook
- [x] Runbook path: \`docs/runbooks/slice_workflow.md\`

## Pilot guardrails
- [x] Protected files are explicitly allowed below:
`;

export function makeRunRoot() {
  const base = join(repoRoot, "tmp/multi-agent/verify-slice");
  mkdirSync(base, { recursive: true });
  return mkdtempSync(join(base, "check-pr-"));
}

export function writeRunRoot(root, options = {}) {
  mkdirSync(join(root, "evidence"), { recursive: true });
  mkdirSync(join(root, "reviews"), { recursive: true });
  mkdirSync(join(root, "reviews/subagents"), { recursive: true });
  writeFileSync(join(root, "run-manifest.md"), "# Manifest\n");
  writeFileSync(join(root, "reviewer-plan.md"), "# Reviewer Plan\n");
  writeFileSync(join(root, "reviews/subagents/security_reviewer.md"), "# Security Reviewer\n");
  writeFileSync(join(root, "reviews/codex-senior-review.md"), "# Codex Senior Review\n");
  writeFileSync(join(root, "reviews/codex-senior-review.json"), json({
    status: "pass",
    reviewer: "codex-senior",
    baseSha: "base",
    headSha: "head",
    changedFiles: ["scripts/example.mjs"],
    receiptPath: "reviews/codex-senior-review.md",
    mustFixCount: 0,
    mustFixDisposition: "none",
  }));
  writeFileSync(join(root, "reviews/subagent-handoff.json"), json({ status: "pass", reviewers: [{ reviewer: "security_reviewer", prompt: join(root, "prompts/security_reviewer.md") }], missingPrompts: [] }));
  writeFileSync(join(root, "reviews/subagent-results.json"), json({
    status: "pass",
    selectedReviewers: ["security_reviewer"],
    results: [{ reviewer: "security_reviewer", status: "complete", receiptPath: "reviews/subagents/security_reviewer.md", verdict: "READY FOR PR", mustFixCount: 0 }],
    unresolvedMustFixCount: 0,
    mustFixDisposition: "none",
  }));
  writeFileSync(join(root, "evidence/nurseconnect-qa.json"), json({
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
  writeFileSync(join(root, "reviews/model-review-preflight.json"), json({ status: "pass", reviewers: requiredReviewers, results: requiredReviewers.map((reviewer) => ({ reviewer, status: "available" })) }));
  writeFileSync(join(root, "reviews/model-review-access.json"), json(options.access ?? { status: "pass", reviewers: requiredReviewers, completed: requiredReviewers, blocked: [] }));
  writeFileSync(join(root, "evidence/model-review.json"), json({
    status: "complete",
    reviewers: requiredReviewers,
    completed: requiredReviewers,
    dryRun: [],
    blocked: [],
    debate: true,
    agreedMustFixCount: 0,
    ...options,
    access: undefined,
  }));
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
