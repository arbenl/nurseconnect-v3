import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
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
        [scriptPath, "--base", "HEAD", "--run-root", runRoot, "--allow-main"],
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
      const reviewerPrompt = readFileSync(
        join(runRoot, "prompts/security_reviewer.md"),
        "utf8"
      );
      const qaSummary = readFileSync(
        join(runRoot, "evidence/nurseconnect-qa.md"),
        "utf8"
      );
      const qaEvidence = JSON.parse(
        readFileSync(join(runRoot, "evidence/nurseconnect-qa.json"), "utf8")
      );
      const modelReviewSummary = readFileSync(
        join(runRoot, "evidence/model-review.md"),
        "utf8"
      );
      const modelReviewEvidence = JSON.parse(
        readFileSync(join(runRoot, "evidence/model-review.json"), "utf8")
      );

      expect(reviewerPlan).toContain(`run_root: \`${runRoot}\``);
      expect(reviewerPlan).toContain(
        `pnpm verify-slice -- --run-root "${runRoot}" --static`
      );
      expect(reviewerPlan).toContain(
        `pnpm verify-slice -- --run-root "${runRoot}" --required-gates`
      );
      expect(reviewerPlan).toContain(`pnpm slice:evidence -- --run-root "${runRoot}"`);
      expect(reviewerPlan).toContain(`pnpm subagent-results -- --run-root "${runRoot}"`);
      expect(reviewerPlan).toContain("--preflight");
      expect(reviewerPlan).toContain("--access-check");
      expect(reviewerPlan).toContain("--fallback-ladder");
      expect(reviewerPlan).toContain("docs/runbooks/slice_playbook_scorecard.md");
      expect(reviewerPlan).toContain("code_review.md");
      expect(reviewerPlan).toContain('--require-reviewers "sonnet46,gemini,copilot"');
      expect(reviewerPlan).toContain("--require-model-preflight --require-model-access --require-model-review --require-subagent-results --require-debate");
      expect(manifest).toContain("base_refresh_status:");
      expect(manifest).toContain("branch_status:");
      expect(manifest).toContain("nurseconnect_qa_status:");
      expect(manifest).toContain("model_review_status:");
      expect(manifest).toContain("model_review_dry_run:");
      expect(reviewerPlan).toContain("nurseconnect_qa_status:");
      expect(reviewerPlan).toContain("model_review_status:");
      expect(reviewerPlan).toContain("model_review_dry_run:");
      expect(reviewerPrompt).toContain("nurseconnect-qa.md");
      expect(reviewerPrompt).toContain("model-review.md");
      expect(orchestrator).toContain("reviewers are read-only");
      expect(qaSummary).toContain("NurseConnect QA Evidence");
      expect(qaSummary).toContain("modularity_audit_status");
      expect(qaEvidence.availableTools).toContain("project_map");
      expect(qaEvidence.availableTools).toContain("scope_audit");
      expect(qaEvidence.availableTools).toContain("modularity_audit");
      expect(qaEvidence.modularityAudit.status).toBe("success");
      expect(modelReviewSummary).toContain("Model Review Evidence");
      expect(modelReviewEvidence.status).toBe("not-run");
    } finally {
      rmSync(runRoot, { recursive: true, force: true });
    }
  }, 15_000);

  it("passes repeatable QA scope prefixes to the NurseConnect QA evidence run", () => {
    const runRoot = mkdtempSync(join(tmpdir(), "nurseconnect-verify-slice-qa-"));

    try {
      execFileSync(
        "bash",
        [
          scriptPath,
          "--base",
          "HEAD",
          "--run-root",
          runRoot,
          "--allow-main",
          "--qa-allowed-path",
          "scripts",
          "--qa-forbidden-path",
          "apps",
        ],
        { cwd: repoRoot, encoding: "utf8" }
      );

      const qaEvidence = JSON.parse(
        readFileSync(join(runRoot, "evidence/nurseconnect-qa.json"), "utf8")
      );

      expect(qaEvidence.allowedPaths).toEqual(["scripts"]);
      expect(qaEvidence.forbiddenPaths).toEqual(["apps"]);
      expect(["success", "error"]).toContain(qaEvidence.status);
    } finally {
      rmSync(runRoot, { recursive: true, force: true });
    }
  }, 15_000);

  it("static mode covers committed, staged, worktree, and untracked diff checks", () => {
    const script = readFileSync(scriptPath, "utf8");

    expect(script).toContain("git-diff-check-committed");
    expect(script).toContain("git diff --check $BASE_COMMIT...HEAD");
    expect(script).toContain("git-diff-check-staged");
    expect(script).toContain("git diff --cached --check");
    expect(script).toContain("git-diff-check-worktree");
    expect(script).toContain("run_untracked_diff_check");
    expect(script).toContain("mcp-preflight");
    expect(script).toContain("repo-hygiene");
    expect(script).toContain("modularity-guard");
    expect(script).toContain("sentinel");
    expect(script).toContain("sonar-agent");
    expect(script).toContain("sentry-advisory");
    expect(script).toContain("slice-evidence");
    expect(script).toContain("model-review-preflight");
    expect(script).toContain("model-review-access-check");
    expect(script).toContain("sonnet46,gemini,copilot");
    expect(script).toContain("docs-only static path");
  });
});
