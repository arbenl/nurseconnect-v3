import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = new URL("../../..", import.meta.url).pathname;
const scriptPath = join(repoRoot, "scripts/multi-agent/verify-slice.sh");

describe("verify-slice workflow", () => {
  it("keeps shell syntax valid", () => {
    execFileSync("bash", ["-n", scriptPath], { cwd: repoRoot });
  });

  it("generates one coherent evidence root with follow-up gate commands", () => {
    const runRoot = mkdtempSync(join(tmpdir(), "nurseconnect-verify-slice-"));

    try {
      execFileSync(
        "bash",
        [scriptPath, "--base", "HEAD", "--run-root", runRoot],
        { cwd: repoRoot, encoding: "utf8" }
      );

      const reviewerPlan = readFileSync(
        join(runRoot, "reviewer-plan.md"),
        "utf8"
      );
      const manifest = readFileSync(join(runRoot, "run-manifest.md"), "utf8");
      const orchestrator = readFileSync(
        join(runRoot, "prompts/orchestrator.md"),
        "utf8"
      );

      expect(reviewerPlan).toContain(`run_root: \`${runRoot}\``);
      expect(reviewerPlan).toContain(
        `pnpm verify-slice -- --run-root "${runRoot}" --static`
      );
      expect(reviewerPlan).toContain(
        `pnpm verify-slice -- --run-root "${runRoot}" --required-gates`
      );
      expect(manifest).toContain("base_refresh_status:");
      expect(manifest).toContain("branch_status:");
      expect(orchestrator).toContain("reviewers are read-only");
    } finally {
      rmSync(runRoot, { recursive: true, force: true });
    }
  });

  it("static mode covers committed, staged, worktree, and untracked diff checks", () => {
    const script = readFileSync(scriptPath, "utf8");

    expect(script).toContain("git-diff-check-committed");
    expect(script).toContain("git diff --check '$BASE_COMMIT'...HEAD");
    expect(script).toContain("git-diff-check-staged");
    expect(script).toContain("git diff --cached --check");
    expect(script).toContain("git-diff-check-worktree");
    expect(script).toContain("run_untracked_diff_check");
  });
});
