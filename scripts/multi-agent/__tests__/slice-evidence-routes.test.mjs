import { describe, expect, it } from "vitest";

import { cleanup, makeRoot, passAccess, passPreflight, requiredReviewers, runSliceEvidence, writeRunRoot } from "./slice-evidence-helpers.mjs";

describe("slice evidence route requirements", () => {
  it("requires successful model route preflight only when requested", () => {
    const root = makeRoot();
    try {
      writeRunRoot(root);
      expect(runSliceEvidence(root, ["--require-model-preflight"]).status).not.toBe(0);
      writeRunRoot(root, { preflight: passPreflight(["claude48", "gemini"]) });
      const allowed = runSliceEvidence(root, ["--require-model-preflight"]);
      expect(JSON.parse(allowed.stdout).checks.modelPreflight.reviewers).toEqual(["claude48", "gemini"]);
    } finally {
      cleanup(root);
    }
  });

  it("fails required model route preflight when a route is blocked", () => {
    const root = makeRoot();
    try {
      writeRunRoot(root, { preflight: { status: "blocked", reviewers: ["claude48", "gemini"], results: [{ reviewer: "claude48", status: "available" }, { reviewer: "gemini", status: "blocked" }] } });
      const report = JSON.parse(runSliceEvidence(root, ["--require-model-preflight"]).stdout);
      expect(report.checks.modelPreflight.blocked).toEqual(["gemini"]);
    } finally {
      cleanup(root);
    }
  });

  it("requires successful model access-check evidence only when requested", () => {
    const root = makeRoot();
    try {
      writeRunRoot(root);
      expect(runSliceEvidence(root, ["--require-model-access"]).status).not.toBe(0);
      writeRunRoot(root, { access: passAccess(["claude48", "gemini"]) });
      const report = JSON.parse(runSliceEvidence(root, ["--require-model-access"]).stdout);
      expect(report.checks.modelAccess.completed).toEqual(["claude48", "gemini"]);
    } finally {
      cleanup(root);
    }
  });

  it("requires the full enterprise reviewer route set when requested", () => {
    const root = makeRoot();
    try {
      writeRunRoot(root, {
        preflight: passPreflight(),
        access: passAccess(),
        modelReview: { status: "dry-run", reviewers: requiredReviewers, completed: [], dryRun: requiredReviewers, blocked: [], debate: true, agreedMustFixCount: 0 },
      });
      const result = runSliceEvidence(root, ["--require-reviewers", requiredReviewers.join(","), "--require-model-preflight", "--require-model-access", "--require-model-review", "--require-subagent-results", "--require-debate", "--allow-dry-run", "--must-fix-disposition", "none"]);
      const report = JSON.parse(result.stdout);
      expect(result.status).toBe(0);
      expect(report.checks.modelAccess.completed).toEqual(requiredReviewers);
      expect(report.checks.modelReview.dryRun).toEqual(requiredReviewers);
    } finally {
      cleanup(root);
    }
  });

  it("allows blocked escalation routes when the required cost-aware reviewers pass", () => {
    const root = makeRoot();
    try {
      const reviewers = ["claude48", ...requiredReviewers];
      writeRunRoot(root, {
        preflight: { status: "blocked", reviewers, results: [{ reviewer: "claude48", status: "blocked" }, ...requiredReviewers.map((reviewer) => ({ reviewer, status: "available" }))] },
        access: { status: "blocked", reviewers, completed: requiredReviewers, blocked: [{ reviewer: "claude48" }] },
        modelReview: { status: "blocked", reviewers, completed: requiredReviewers, dryRun: [], blocked: ["claude48"], debate: true, agreedMustFixCount: 0 },
      });
      const result = runSliceEvidence(root, ["--require-reviewers", requiredReviewers.join(","), "--require-model-preflight", "--require-model-access", "--require-model-review", "--require-subagent-results", "--require-debate", "--must-fix-disposition", "none"]);
      expect(JSON.parse(result.stdout).checks.modelReview.blocked).toEqual(["claude48"]);
      expect(result.status).toBe(0);
    } finally {
      cleanup(root);
    }
  });

  it("allows a model-review rejection disposition when subagent findings are clean", () => {
    const root = makeRoot();
    try {
      writeRunRoot(root, { modelReview: { status: "complete", completed: ["sonnet46"], dryRun: [], blocked: [], debate: true, agreedMustFixCount: 1 } });
      const result = runSliceEvidence(root, ["--require-model-review", "--require-subagent-results", "--require-debate", "--must-fix-disposition", "rejected: model finding handled by strict access gate"]);
      expect(result.status).toBe(0);
    } finally {
      cleanup(root);
    }
  });

  it("allows blocked optional model-review routes with an explicit disposition", () => {
    const root = makeRoot();
    try {
      writeRunRoot(root, { modelReview: { status: "blocked", reviewers: ["sonnet46", "gemini"], completed: ["sonnet46"], dryRun: [], blocked: ["gemini"], debate: true, agreedMustFixCount: 1 } });
      const result = runSliceEvidence(root, ["--require-model-review", "--require-debate", "--must-fix-disposition", "rejected: gemini blocked and was not counted as approval"]);
      const report = JSON.parse(result.stdout);
      expect(result.status).toBe(0);
      expect(report.checks.modelReview.blocked).toEqual(["gemini"]);
    } finally {
      cleanup(root);
    }
  });
});
