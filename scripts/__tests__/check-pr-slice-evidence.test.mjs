import { describe, expect, it } from "vitest";

import { validatePrSliceEvidence } from "../check-pr-slice-evidence.mjs";
import { goodEvidence } from "./pr-slice-evidence-helpers.mjs";

describe("PR slice evidence validator", () => {
  it("passes a Tier 3 PR body with QA, model-review, debate, and slice evidence entries", () => {
    const result = validatePrSliceEvidence({ body: goodEvidence, files: ["apps/web/src/app/api/admin/users/route.ts"] });
    expect(result.status).toBe("pass");
    expect(result.highRisk).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("fails when tracker ID, MUST_FIX disposition, and evidence checks are missing", () => {
    const result = validatePrSliceEvidence({
      body: `
## Summary
- Missing the slice contract.

## Evidence
### Verify Slice
- [x] Run root used for reviewer plan and gate logs: \`tmp/multi-agent/verify-slice/run/\`
`,
      files: [],
    });
    expect(result.status).toBe("fail");
    expect(result.errors).toContain("PR body must include a NurseConnect tracker ID like NC-E2-03 or NC-EG-00.");
    expect(result.errors).toContain("Evidence section missing reviewer plan.");
    expect(result.errors).toContain("Evidence section missing subagent handoff.");
    expect(result.errors).toContain("Evidence section missing plugin activation.");
    expect(result.errors).toContain("Evidence section missing modularity guard.");
    expect(result.errors).toContain('Evidence section must include MUST_FIX disposition like "MUST_FIX: 0 (none)" or "MUST_FIX: 2 (all fixed)".');
  });

  it("accepts Phase C band tracker IDs (NC-EG/NC-TB/NC-CQ) and still rejects unknown bands", () => {
    for (const id of ["NC-EG-00", "NC-TB-01", "NC-CQ-05", "NC-E2-03"]) {
      const result = validatePrSliceEvidence({ body: goodEvidence.replace(/NC-E\d+-\d+/, id), files: [] });
      expect(result.errors.filter((e) => e.includes("tracker ID"))).toEqual([]);
      expect(result.status).toBe("pass");
    }
    for (const id of ["NC-XX-99", "nc-eg-00", "NC-EGG-01"]) {
      const bogus = validatePrSliceEvidence({ body: goodEvidence.replace(/NC-E\d+-\d+/, id), files: [] });
      expect(bogus.errors).toContain("PR body must include a NurseConnect tracker ID like NC-E2-03 or NC-EG-00.");
    }
  });

  it("requires live model evidence or an explicit blocked-route disposition for protected files", () => {
    const result = validatePrSliceEvidence({
      body: `
## Summary
- NC-E2-03 platform authz slice.

## Evidence
### Verify Slice
- [x] Run root used for reviewer plan and gate logs: \`tmp/multi-agent/verify-slice/run/\`
- [x] Reviewer plan: \`tmp/multi-agent/verify-slice/run/reviewer-plan.md\`
- [x] Subagent handoff: \`tmp/multi-agent/verify-slice/run/reviews/subagent-handoff.md\`
- [x] NurseConnect QA evidence: \`tmp/multi-agent/verify-slice/run/evidence/nurseconnect-qa.md\`
- [x] Model review evidence: \`tmp/multi-agent/verify-slice/run/evidence/model-review.md\`
- [x] MUST_FIX: 0 (none)
- [x] Plugin activation: \`docs/runbooks/plugin_activation_policy.md\` applied; activated plugins: GitHub
- [x] \`pnpm modularity:guard -- --base <base-commit>\` result: pass
- [x] \`pnpm verify-slice -- --run-root <run-root> --static\` result: pass
- [x] \`pnpm verify-slice -- --run-root <run-root> --required-gates\` result: pass
- [x] \`pnpm slice:evidence -- --run-root <run-root>\` result: pass
`,
      files: ["packages/contracts/src/index.ts"],
    });
    expect(result.status).toBe("fail");
    expect(result.errors).toContain("Tier 2/3 or protected-file PRs must include model route preflight evidence.");
    expect(result.errors).toContain("Tier 2/3 or protected-file PRs must include model route access-check evidence.");
    expect(result.errors.join("\n")).toContain("explicit blocked external-review disposition");
  });

  it("allows protected PR evidence when external reviewers are blocked and not counted as approval", () => {
    const body = goodEvidence
      .replace(/- \[x\] Subagent results:[^\n]+\n/, "")
      .replace(/- \[x\] Model debate:[^\n]+\n/, "- [x] Model debate skipped: model access blocked; external reviewers were not counted as approval.\n")
      .replace(/- \[x\] `pnpm slice:evidence -- --run-root <run-root> --require-reviewers[^\n]+\n/, "");
    const result = validatePrSliceEvidence({ body, files: ["scripts/multi-agent/model-review.mjs"] });
    expect(result.status).toBe("pass");
  });

  it("rejects inconsistent MUST_FIX disposition counts and dry-run allowance", () => {
    const nonzeroNone = validatePrSliceEvidence({ body: goodEvidence.replace("MUST_FIX: 0 (none)", "MUST_FIX: 2 (none)"), files: [] });
    const zeroFixed = validatePrSliceEvidence({ body: goodEvidence.replace("MUST_FIX: 0 (none)", "MUST_FIX: 0 (all fixed)"), files: [] });
    const dryRun = validatePrSliceEvidence({ body: goodEvidence.replace('--must-fix-disposition "none"` result: pass', '--must-fix-disposition "none" --allow-dry-run` result: pass'), files: ["apps/web/src/app/api/admin/users/route.ts"] });
    expect(nonzeroNone.errors).toContain('Evidence section cannot use "none" disposition when MUST_FIX count is greater than 0.');
    expect(zeroFixed.errors).toContain('Evidence section should use "MUST_FIX: 0 (none)" when there are no MUST_FIX findings.');
    expect(dryRun.errors).toContain("Tier 2/3 or protected-file PRs must not use --allow-dry-run in strict slice:evidence evidence.");
  });

  it("requires a standalone debate receipt for protected files", () => {
    const result = validatePrSliceEvidence({ body: goodEvidence.replace(/- \[x\] Model debate:[^\n]+\n/, ""), files: ["apps/web/src/app/api/admin/users/route.ts"] });
    expect(result.status).toBe("fail");
    expect(result.errors).toContain("Strict Tier 2/3 or protected-file PR evidence must include model debate receipt evidence.");
  });

  it("requires strict evidence for broad gate tooling changes even when labeled Tier 1", () => {
    const body = goodEvidence
      .replace("Tier 3", "Tier 1")
      .replace(/- \[x\] Subagent results:[^\n]+\n/, "")
      .replace(/--require-subagent-results /, "");
    const result = validatePrSliceEvidence({ body, files: ["scripts/multi-agent/verify-slice.sh"] });
    expect(result.highRisk).toBe(true);
    expect(result.errors.join("\n")).toContain("explicit blocked external-review disposition");
  });
});
