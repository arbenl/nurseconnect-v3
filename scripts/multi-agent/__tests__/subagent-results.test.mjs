import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const scriptPath = join(repoRoot, "scripts/multi-agent/subagent-results.mjs");

function makeRunRoot() {
  const root = mkdtempSync(join(tmpdir(), "nurseconnect-subagent-results-"));
  mkdirSync(join(root, "reviews/subagents"), { recursive: true });
  writeFileSync(join(root, "reviews/subagent-handoff.json"), JSON.stringify({
    status: "pass",
    reviewers: [{ reviewer: "security_reviewer" }, { reviewer: "qa_reviewer" }],
  }));
  return root;
}

function run(root, args = []) {
  return spawnSync("node", [scriptPath, "--run-root", root, ...args], { cwd: repoRoot, encoding: "utf8" });
}

describe("subagent results writer", () => {
  it("writes pass evidence from completed reviewer receipts", () => {
    const root = makeRunRoot();
    try {
      writeFileSync(join(root, "reviews/subagents/security_reviewer.md"), "## MUST_FIX\n- none\n\nREADY FOR PR\n");
      writeFileSync(join(root, "reviews/subagents/qa_reviewer.md"), "- SHOULD_FIX: add edge case\n\nREADY FOR PR\n");
      const result = run(root, ["--must-fix-disposition", "none"]);
      const evidence = JSON.parse(readFileSync(join(root, "reviews/subagent-results.json"), "utf8"));
      expect(result.status).toBe(0);
      expect(evidence.status).toBe("pass");
      expect(evidence.unresolvedMustFixCount).toBe(0);
      expect(evidence.results.map((item) => item.reviewer)).toEqual(["security_reviewer", "qa_reviewer"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when a selected reviewer receipt is missing", () => {
    const root = makeRunRoot();
    try {
      writeFileSync(join(root, "reviews/subagents/security_reviewer.md"), "READY FOR PR\n");
      const result = run(root, ["--must-fix-disposition", "none"]);
      const evidence = JSON.parse(readFileSync(join(root, "reviews/subagent-results.json"), "utf8"));
      expect(result.status).not.toBe(0);
      expect(evidence.missing).toEqual(["qa_reviewer"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when a selected reviewer verdict is not ready", () => {
    const root = makeRunRoot();
    try {
      writeFileSync(join(root, "reviews/subagents/security_reviewer.md"), "READY FOR PR\n");
      writeFileSync(join(root, "reviews/subagents/qa_reviewer.md"), "## **MUST_FIX**\n1. missing gate\n\nREADY FOR PR AFTER MUST-FIX ITEMS\n");
      const result = run(root, ["--must-fix-disposition", "none"]);
      const evidence = JSON.parse(readFileSync(join(root, "reviews/subagent-results.json"), "utf8"));
      expect(result.status).not.toBe(0);
      expect(evidence.blockingVerdicts).toEqual(["qa_reviewer"]);
      expect(evidence.unresolvedMustFixCount).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
