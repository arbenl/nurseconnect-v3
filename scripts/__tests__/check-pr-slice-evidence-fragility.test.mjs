import { describe, expect, it } from "vitest";

import { validatePrSliceEvidence } from "../check-pr-slice-evidence.mjs";
import { goodEvidence } from "./pr-slice-evidence-helpers.mjs";

describe("PR slice evidence parser fragility", () => {
  it("does not treat a Required Gates heading as required-gates command evidence", () => {
    const body = goodEvidence
      .replace(/- \[x\] `pnpm verify-slice -- --run-root <run-root> --required-gates` result: pass\n/, "")
      .replace("### Verify Slice", "### Verify Slice\n\n### Required Gates");
    const result = validatePrSliceEvidence({ body, files: [] });

    expect(result.status).toBe("fail");
    expect(result.errors).toContain("Evidence section missing verify-slice required gates.");
  });

  it("accepts strict release gate wording as required-gates evidence", () => {
    const body = goodEvidence.replace(
      /- \[x\] `pnpm verify-slice -- --run-root <run-root> --required-gates` result: pass\n/,
      "- [x] Required gates covered by the pre-push strict release gate.\n"
    );
    const result = validatePrSliceEvidence({ body, files: [] });

    expect(result.status).toBe("pass");
  });
});
