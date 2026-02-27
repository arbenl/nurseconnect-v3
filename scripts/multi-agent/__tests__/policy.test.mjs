import { describe, expect, it } from "vitest";

import { decideExecutionMode } from "../lib/policy-engine.mjs";

const policyConfig = {
  thresholds: {
    complexityMultiMin: 7,
    independentTasksMultiMin: 2,
    multiScoreMin: 3,
    complianceBoost: 2,
    overBudgetPenalty: 3,
  },
};

describe("policy engine", () => {
  it("returns multi mode with deterministic reason codes when complexity and independence are high", () => {
    const decision = decideExecutionMode(
      {
        mode: "auto",
        complexity: 9,
        estimatedCostUsd: 3,
        budgetUsd: 10,
        independentTaskCount: 3,
        requiresComplianceReview: false,
      },
      policyConfig
    );

    expect(decision.mode).toBe("multi");
    expect(decision.reasonCodes).toEqual([
      "MODE_AUTO",
      "COMPLEXITY_HIGH",
      "INDEPENDENT_TASKS_HIGH",
      "COMPLIANCE_NOT_REQUIRED",
      "COST_WITHIN_BUDGET",
      "SCORE_AT_OR_ABOVE_MULTI_THRESHOLD",
      "AUTO_MULTI",
    ]);
  });

  it("returns single mode when estimated cost exceeds budget and signals are weak", () => {
    const decision = decideExecutionMode(
      {
        mode: "auto",
        complexity: 3,
        estimatedCostUsd: 15,
        budgetUsd: 5,
        independentTaskCount: 1,
        requiresComplianceReview: false,
      },
      policyConfig
    );

    expect(decision.mode).toBe("single");
    expect(decision.reasonCodes).toEqual([
      "MODE_AUTO",
      "COMPLEXITY_LOW",
      "INDEPENDENT_TASKS_LOW",
      "COMPLIANCE_NOT_REQUIRED",
      "COST_OVER_BUDGET",
      "SCORE_BELOW_MULTI_THRESHOLD",
      "AUTO_SINGLE",
    ]);
  });

  it("promotes multi mode when compliance review is required", () => {
    const decision = decideExecutionMode(
      {
        mode: "auto",
        complexity: 4,
        estimatedCostUsd: 4,
        budgetUsd: 5,
        independentTaskCount: 1,
        requiresComplianceReview: true,
      },
      policyConfig
    );

    expect(decision.mode).toBe("multi");
    expect(decision.reasonCodes).toEqual([
      "MODE_AUTO",
      "COMPLEXITY_LOW",
      "INDEPENDENT_TASKS_LOW",
      "COMPLIANCE_REQUIRED",
      "COST_WITHIN_BUDGET",
      "SCORE_AT_OR_ABOVE_MULTI_THRESHOLD",
      "AUTO_MULTI",
    ]);
  });
});
