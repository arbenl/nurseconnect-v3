import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const scriptPath = join(repoRoot, "scripts/multi-agent/verify-slice.sh");

describe("verify-slice model review evidence", () => {
  it("attaches model-review receipts to a run root", () => {
    const runRoot = mkdtempSync(join(tmpdir(), "nurseconnect-verify-slice-model-"));
    const packet = join(runRoot, "packet.md");
    writeFileSync(packet, "Safe model review packet.");
    try {
      execFileSync("bash", [
        scriptPath,
        "--base",
        "HEAD",
        "--run-root",
        runRoot,
        "--allow-main",
        "--model-review-packet",
        packet,
        "--model-reviewers",
        "claude",
        "--model-review-dry-run",
        "--model-review-debate",
      ], { cwd: repoRoot, encoding: "utf8" });
      const receipt = readFileSync(join(runRoot, "reviews/claude.json"), "utf8");
      const debate = readFileSync(join(runRoot, "reviews/debate.md"), "utf8");
      const manifest = readFileSync(join(runRoot, "run-manifest.md"), "utf8");
      const reviewerPlan = readFileSync(join(runRoot, "reviewer-plan.md"), "utf8");
      const evidence = JSON.parse(readFileSync(join(runRoot, "evidence/model-review.json"), "utf8"));
      expect(receipt).toContain("Claude Sonnet");
      expect(debate).toContain("Model Critique Debate");
      expect(manifest).toContain("model_review_status: `dry-run`");
      expect(reviewerPlan).toContain("model_review_dry_run: `claude`");
      expect(evidence).toMatchObject({ status: "dry-run", dryRun: ["claude"], debate: true });
    } finally {
      rmSync(runRoot, { recursive: true, force: true });
    }
  }, 15_000);
});
