const DEFAULT_POLICY = {
  thresholds: {
    complexityMultiMin: 7,
    independentTasksMultiMin: 2,
    multiScoreMin: 3,
    complianceBoost: 2,
    overBudgetPenalty: 3,
  },
};

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return fallback;
}

export function decideExecutionMode(input = {}, policyConfig = DEFAULT_POLICY) {
  const thresholds = {
    ...DEFAULT_POLICY.thresholds,
    ...(policyConfig?.thresholds || {}),
  };

  const mode = String(input.mode || "auto").toLowerCase();
  const complexity = toFiniteNumber(input.complexity, 0);
  const estimatedCostUsd = toFiniteNumber(input.estimatedCostUsd, 0);
  const budgetUsd = toFiniteNumber(input.budgetUsd, 0);
  const independentTaskCount = toFiniteNumber(input.independentTaskCount, 0);
  const requiresComplianceReview = Boolean(input.requiresComplianceReview);

  const reasonCodes = [];

  if (mode === "single") {
    reasonCodes.push("MODE_FORCED_SINGLE");
    return {
      mode: "single",
      score: 0,
      reasonCodes,
      inputs: {
        complexity,
        estimatedCostUsd,
        budgetUsd,
        independentTaskCount,
        requiresComplianceReview,
      },
    };
  }

  if (mode === "multi") {
    reasonCodes.push("MODE_FORCED_MULTI");
    return {
      mode: "multi",
      score: 0,
      reasonCodes,
      inputs: {
        complexity,
        estimatedCostUsd,
        budgetUsd,
        independentTaskCount,
        requiresComplianceReview,
      },
    };
  }

  reasonCodes.push("MODE_AUTO");

  let score = 0;

  if (complexity >= thresholds.complexityMultiMin) {
    score += 2;
    reasonCodes.push("COMPLEXITY_HIGH");
  } else {
    score -= 1;
    reasonCodes.push("COMPLEXITY_LOW");
  }

  if (independentTaskCount >= thresholds.independentTasksMultiMin) {
    score += 2;
    reasonCodes.push("INDEPENDENT_TASKS_HIGH");
  } else {
    score -= 1;
    reasonCodes.push("INDEPENDENT_TASKS_LOW");
  }

  if (requiresComplianceReview) {
    score += thresholds.complianceBoost;
    reasonCodes.push("COMPLIANCE_REQUIRED");
  } else {
    reasonCodes.push("COMPLIANCE_NOT_REQUIRED");
  }

  if (budgetUsd <= 0 || estimatedCostUsd <= budgetUsd) {
    score += 1;
    reasonCodes.push("COST_WITHIN_BUDGET");
  } else {
    score -= thresholds.overBudgetPenalty;
    reasonCodes.push("COST_OVER_BUDGET");
  }

  const complianceAdjustedThreshold = requiresComplianceReview
    ? Math.max(1, thresholds.multiScoreMin - thresholds.complianceBoost)
    : thresholds.multiScoreMin;

  const resolvedMode = score >= complianceAdjustedThreshold ? "multi" : "single";
  if (resolvedMode === "multi") {
    reasonCodes.push("SCORE_AT_OR_ABOVE_MULTI_THRESHOLD");
    reasonCodes.push("AUTO_MULTI");
  } else {
    reasonCodes.push("SCORE_BELOW_MULTI_THRESHOLD");
    reasonCodes.push("AUTO_SINGLE");
  }

  return {
    mode: resolvedMode,
    score,
    reasonCodes,
    thresholds,
    inputs: {
      complexity,
      estimatedCostUsd,
      budgetUsd,
      independentTaskCount,
      requiresComplianceReview,
    },
  };
}
