import { describe, expect, it } from "vitest";

import { cleanup, makeRoot, runSliceEvidence, writeRunRoot } from "./slice-evidence-helpers.mjs";

describe("slice evidence checker", () => {
  it("passes when verify-slice QA and model-review evidence are present", () => {
    const root = makeRoot();
    try {
      writeRunRoot(root);
      const result = runSliceEvidence(root);
      const report = JSON.parse(result.stdout);
      expect(result.status).toBe(0);
      expect(report.status).toBe("pass");
      expect(report.checks.nurseconnectQa.status).toBe("pass");
      expect(report.checks.modelReview.status).toBe("pass");
    } finally {
      cleanup(root);
    }
  });

  it("allows dry-run model-review receipts only when explicitly allowed", () => {
    const root = makeRoot();
    try {
      writeRunRoot(root, { modelReview: { status: "dry-run", completed: [], dryRun: ["claude", "gemini", "copilot"], blocked: [], debate: true } });
      expect(runSliceEvidence(root, ["--require-model-review"]).status).not.toBe(0);
      const allowed = runSliceEvidence(root, ["--require-model-review", "--require-debate", "--allow-dry-run"]);
      const report = JSON.parse(allowed.stdout);
      expect(allowed.status).toBe(0);
      expect(report.checks.modelReview.dryRun).toEqual(["claude", "gemini", "copilot"]);
    } finally {
      cleanup(root);
    }
  });

  it("fails when nurseconnect_qa evidence is not successful", () => {
    const root = makeRoot();
    try {
      writeRunRoot(root, { qa: { status: "blocked", availableTools: [], blocker: "nurseconnect_qa unavailable" } });
      const result = runSliceEvidence(root);
      const report = JSON.parse(result.stdout);
      expect(result.status).not.toBe(0);
      expect(report.checks.nurseconnectQa.blocker).toBe("nurseconnect_qa unavailable");
    } finally {
      cleanup(root);
    }
  });

  it("records optional blocked model-review routes without making base evidence fail", () => {
    const root = makeRoot();
    try {
      writeRunRoot(root, { modelReview: { status: "blocked", completed: [], dryRun: [], blocked: ["claude"], debate: false } });
      const result = runSliceEvidence(root);
      const report = JSON.parse(result.stdout);
      expect(result.status).toBe(0);
      expect(report.checks.modelReview.blocked).toEqual(["claude"]);
      const required = runSliceEvidence(root, ["--require-model-review"]);
      expect(required.status).not.toBe(0);
    } finally {
      cleanup(root);
    }
  });

  it("records optional model-review MUST_FIX candidates without failing base evidence", () => {
    const root = makeRoot();
    try {
      writeRunRoot(root, { modelReview: { status: "complete", completed: ["sonnet46"], dryRun: [], blocked: [], debate: true, agreedMustFixCount: 1 } });
      expect(runSliceEvidence(root).status).toBe(0);
      expect(runSliceEvidence(root, ["--require-model-review", "--require-debate"]).status).not.toBe(0);
    } finally {
      cleanup(root);
    }
  });
});
