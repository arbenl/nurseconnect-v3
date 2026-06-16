import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { auditBranchProtection } from "../check-branch-protection.mjs";

const expectedConfig = JSON.parse(readFileSync(".github/branch-protection.json", "utf8"));

function observed(overrides = {}) {
  const payload = expectedConfig.payload;
  return {
    required_status_checks: {
      strict: payload.required_status_checks.strict,
      contexts: [...payload.required_status_checks.contexts],
    },
    enforce_admins: { enabled: payload.enforce_admins },
    required_pull_request_reviews: { ...payload.required_pull_request_reviews },
    required_conversation_resolution: { enabled: payload.required_conversation_resolution },
    allow_force_pushes: { enabled: payload.allow_force_pushes },
    allow_deletions: { enabled: payload.allow_deletions },
    ...overrides,
  };
}

describe("branch protection audit", () => {
  it("passes when live protection matches the checked-in NurseConnect requirements", () => {
    const result = auditBranchProtection({ expectedConfig, observedProtection: observed() });

    expect(result.status).toBe("pass");
    expect(result.errors).toEqual([]);
  });

  it("fails when required checks or review controls are missing", () => {
    const result = auditBranchProtection({
      expectedConfig,
      observedProtection: observed({
        required_status_checks: {
          strict: false,
          contexts: ["Type Check & Lint"],
        },
        enforce_admins: { enabled: false },
        required_pull_request_reviews: {
          dismiss_stale_reviews: false,
          require_code_owner_reviews: false,
          required_approving_review_count: 0,
        },
        required_conversation_resolution: { enabled: false },
        allow_force_pushes: { enabled: true },
      }),
    });

    expect(result.status).toBe("fail");
    expect(result.errors).toContain("required_status_checks.strict must be true");
    expect(result.errors).toContain("missing required status check: PR Finalizer");
    expect(result.errors).toContain("enforce_admins must be true");
    expect(result.errors).toContain("required_pull_request_reviews.require_code_owner_reviews is not enforced");
    expect(result.errors).toContain("required_conversation_resolution is not enforced");
    expect(result.errors).toContain("allow_force_pushes must be false");
  });

  it("accepts GitHub check objects as status-check evidence", () => {
    const contexts = expectedConfig.payload.required_status_checks.contexts.map((context) => ({ context }));
    const result = auditBranchProtection({
      expectedConfig,
      observedProtection: observed({ required_status_checks: { strict: true, checks: contexts } }),
    });

    expect(result.status).toBe("pass");
  });
});
