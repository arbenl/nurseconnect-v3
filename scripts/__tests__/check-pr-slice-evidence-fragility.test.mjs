import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { validatePrSliceEvidence } from "../check-pr-slice-evidence.mjs";
import { collectRegularHeadFiles } from "../ent-gates/evidence.mjs";
import { entGateFiles, goodEvidence } from "./pr-slice-evidence-helpers.mjs";

const fixtureKeys = ["BASE_COMMIT", "CI", "GATE_POLICY_BASE", "GITHUB_ACTIONS", "GITHUB_BASE_REF", "GITHUB_EVENT_NAME", "GITHUB_HEAD_REF"];
const savedEnv = Object.fromEntries(fixtureKeys.map((key) => [key, process.env[key]]));
beforeAll(() => { for (const key of fixtureKeys) delete process.env[key]; });
afterAll(() => { for (const key of fixtureKeys) savedEnv[key] === undefined ? delete process.env[key] : process.env[key] = savedEnv[key]; });

describe("PR slice evidence parser fragility", () => {
  it("accepts only regular authority artifacts", () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-ent-artifact-"));
    try {
      writeFileSync(join(root, "regular.md"), "design\n"); symlinkSync("regular.md", join(root, "linked.md"));
      expect(collectRegularHeadFiles(["regular.md", "linked.md", "missing.md"], root)).toEqual(["regular.md"]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it("does not treat a Required Gates heading as required-gates command evidence", () => {
    const previousComplete = process.env.PR_FILES_COMPLETE;
    const body = goodEvidence
      .replace(/- \[x\] `pnpm verify-slice -- --run-root <run-root> --required-gates` result: pass\n/, "")
      .replace("### Verify Slice", "### Verify Slice\n\n### Required Gates");
    try {
      process.env.PR_FILES_COMPLETE = "1";
      const result = validatePrSliceEvidence({ body, files: [] });
      expect(result.status).toBe("fail");
      expect(result.errors).toContain("Evidence section missing verify-slice required gates.");
      expect(result.errors.join("\n")).toContain("evidence path is not in the slice diff");
    } finally {
      if (previousComplete === undefined) delete process.env.PR_FILES_COMPLETE;
      else process.env.PR_FILES_COMPLETE = previousComplete;
    }
  });

  it("accepts strict release gate wording as required-gates evidence", () => {
    const previousComplete = process.env.PR_FILES_COMPLETE;
    const body = goodEvidence.replace(
      /- \[x\] `pnpm verify-slice -- --run-root <run-root> --required-gates` result: pass\n/,
      "- [x] Required gates covered by the pre-push strict release gate.\n"
    );
    try {
      process.env.PR_FILES_COMPLETE = "1";
      const result = validatePrSliceEvidence({ body, files: entGateFiles });
      expect(result.status).toBe("pass");
    } finally {
      if (previousComplete === undefined) delete process.env.PR_FILES_COMPLETE;
      else process.env.PR_FILES_COMPLETE = previousComplete;
    }
  });

  it("rejects a declared-complete non-empty list missing required gate evidence", () => {
    const previousComplete = process.env.PR_FILES_COMPLETE;
    try {
      process.env.PR_FILES_COMPLETE = "1";
      const files = entGateFiles.filter((file) => !file.includes("/threat-models/"));
      const result = validatePrSliceEvidence({ body: goodEvidence, files });
      expect(result.status).toBe("fail");
      expect(result.errors.join("\n")).toContain("ent-tm evidence path is not in the slice diff");
    } finally {
      if (previousComplete === undefined) delete process.env.PR_FILES_COMPLETE;
      else process.env.PR_FILES_COMPLETE = previousComplete;
    }
  });
});
