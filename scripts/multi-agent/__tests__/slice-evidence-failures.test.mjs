import { describe, expect, it } from "vitest";

import { cleanup, makeRoot, passAccess, passPreflight, requiredReviewers, runSliceEvidence, writeRunRoot } from "./slice-evidence-helpers.mjs";

describe("slice evidence failure reporting", () => {
  it("fails required model access-check when a route is blocked", () => {
    const root = makeRoot();
    try {
      writeRunRoot(root, { access: { status: "blocked", reviewers: ["claude48", "gemini"], completed: ["claude48"], blocked: [{ reviewer: "gemini" }] } });
      const report = JSON.parse(runSliceEvidence(root, ["--require-model-access"]).stdout);
      expect(report.checks.modelAccess.blocked).toEqual(["gemini"]);
    } finally {
      cleanup(root);
    }
  });

  it("fails when required enterprise reviewer routes are missing", () => {
    const root = makeRoot();
    try {
      const partial = ["claude48", "gemini"];
      writeRunRoot(root, {
        preflight: passPreflight(partial),
        access: passAccess(partial),
        modelReview: { status: "dry-run", reviewers: partial, completed: [], dryRun: partial, blocked: [], debate: true, agreedMustFixCount: 0 },
      });
      const result = runSliceEvidence(root, ["--require-reviewers", requiredReviewers.join(","), "--require-model-preflight", "--require-model-access", "--require-model-review", "--require-subagent-results", "--require-debate", "--allow-dry-run", "--must-fix-disposition", "none"]);
      const report = JSON.parse(result.stdout);
      expect(result.status).not.toBe(0);
      expect(report.checks.modelReview.missingReviewers).toEqual(["sonnet46"]);
    } finally {
      cleanup(root);
    }
  });

  it("fails when required enterprise reviewer routes are blocked", () => {
    const root = makeRoot();
    try {
      writeRunRoot(root, {
        preflight: passPreflight(),
        access: passAccess(),
        modelReview: { status: "blocked", reviewers: requiredReviewers, completed: requiredReviewers.slice(1), dryRun: [], blocked: ["sonnet46"], debate: true, agreedMustFixCount: 0 },
      });
      const result = runSliceEvidence(root, ["--require-reviewers", requiredReviewers.join(","), "--require-model-review", "--require-debate", "--must-fix-disposition", "none"]);
      const report = JSON.parse(result.stdout);
      expect(result.status).not.toBe(0);
      expect(report.checks.modelReview.blocked).toEqual(["sonnet46"]);
    } finally {
      cleanup(root);
    }
  });

  it("fails when nurseconnect_qa identity evidence does not prove the nurse_qa alias", () => {
    const root = makeRoot();
    try {
      writeRunRoot(root, {
        qa: {
          status: "success",
          mcpIdentity: { canonical: "nurseconnect_qa", effective: "nurseconnect_qa", aliases: [], owned: ["nurseconnect_qa"], forbidden: [], configured: ["nurseconnect_qa"] },
          availableTools: ["branch_status", "modularity_audit", "project_map", "scope_audit", "slice_evidence_audit"],
          branchStatus: { changedFileCount: 2 },
          modularityAudit: { status: "success" },
        },
      });
      const report = JSON.parse(runSliceEvidence(root).stdout);
      expect(report.checks.nurseconnectQa.missingIdentity).toEqual(["alias:nurse_qa", "owned:nurse_qa", "configured:nurse_qa", "forbidden:interdomestik_qa"]);
    } finally {
      cleanup(root);
    }
  });

  it("requires complete subagent reviewer receipts in strict mode", () => {
    const root = makeRoot();
    try {
      writeRunRoot(root, {
        subagentHandoff: {
          status: "pass",
          reviewers: [{ reviewer: "security_reviewer" }, { reviewer: "api_reviewer" }],
          missingPrompts: [],
        },
        subagentResults: {
          status: "pass",
          selectedReviewers: ["security_reviewer"],
          results: [{ reviewer: "security_reviewer", status: "complete", receiptPath: "reviews/subagents/security_reviewer.md", verdict: "READY FOR PR", mustFixCount: 0 }],
          unresolvedMustFixCount: 0,
        },
      });
      const report = JSON.parse(runSliceEvidence(root, ["--require-subagent-results"]).stdout);
      expect(report.checks.subagentResults.missing).toEqual(["api_reviewer"]);
    } finally {
      cleanup(root);
    }
  });

  it("fails strict subagent evidence when a reviewer verdict is not ready", () => {
    const root = makeRoot();
    try {
      writeRunRoot(root, {
        subagentResults: {
          status: "pass",
          selectedReviewers: ["security_reviewer"],
          results: [{ reviewer: "security_reviewer", status: "complete", receiptPath: "reviews/subagents/security_reviewer.md", verdict: "NOT READY FOR PR", mustFixCount: 0 }],
          unresolvedMustFixCount: 0,
        },
      });
      const report = JSON.parse(runSliceEvidence(root, ["--require-subagent-results"]).stdout);
      expect(report.checks.subagentResults.blockingVerdicts).toEqual(["security_reviewer"]);
    } finally {
      cleanup(root);
    }
  });

  it("requires a fixed or rejected disposition when model debate found MUST_FIX candidates", () => {
    const root = makeRoot();
    try {
      writeRunRoot(root, { modelReview: { status: "complete", completed: ["claude48"], dryRun: [], blocked: [], debate: true, agreedMustFixCount: 2 } });
      const missing = JSON.parse(runSliceEvidence(root, ["--require-model-review", "--require-debate"]).stdout);
      expect(missing.checks.modelReview.message).toContain("MUST_FIX candidates require");
      const fixed = runSliceEvidence(root, ["--require-model-review", "--require-debate", "--must-fix-disposition", "all fixed"]);
      expect(JSON.parse(fixed.stdout).checks.modelReview.mustFixDisposition).toBe("all fixed");
    } finally {
      cleanup(root);
    }
  });
});
