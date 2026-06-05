import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const scriptPath = join(repoRoot, "scripts/multi-agent/verify-slice.sh");

describe("verify-slice subagent handoff", () => {
  it("writes structured reviewer handoff evidence", () => {
    const runRoot = mkdtempSync(join(tmpdir(), "nurseconnect-subagent-handoff-"));

    try {
      execFileSync("bash", [scriptPath, "--base", "HEAD", "--run-root", runRoot, "--allow-main"], {
        cwd: repoRoot,
        encoding: "utf8",
      });

      const handoff = JSON.parse(readFileSync(join(runRoot, "reviews/subagent-handoff.json"), "utf8"));
      const handoffMarkdown = readFileSync(join(runRoot, "reviews/subagent-handoff.md"), "utf8");
      const reviewerPlan = readFileSync(join(runRoot, "reviewer-plan.md"), "utf8");

      expect(handoff.status).toBe("pass");
      expect(handoff.reviewers.map((item) => item.reviewer)).toContain("security_reviewer");
      expect(handoff.orchestrator).toBe(join(runRoot, "prompts/orchestrator.md"));
      expect(handoffMarkdown).toContain("Subagent Reviewer Handoff");
      expect(reviewerPlan).toContain("subagent-handoff.md");
    } finally {
      rmSync(runRoot, { recursive: true, force: true });
    }
  }, 15_000);
});
