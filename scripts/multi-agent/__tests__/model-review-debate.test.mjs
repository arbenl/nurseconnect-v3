import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { writeDebate } from "../lib/model-review-debate.mjs";

describe("model-review debate synthesis", () => {
  it("counts actual findings without treating section headings as findings", () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-model-debate-"));
    try {
      writeDebate(root, [{
        reviewer: "sonnet46",
        provider: "claude",
        model: "claude-sonnet-4-6",
        role: "review",
        status: "complete",
        exitCode: 0,
        stdout: [
          "### MUST_FIX",
          "- none",
          "### SHOULD_FIX",
          "- tighten docs",
          "**MUST_FIX**",
          "1. Blocked quorum is ambiguous",
        ].join("\n"),
        stderr: "",
      }]);
      const debate = JSON.parse(readFileSync(join(root, "debate.json"), "utf8"));
      expect(debate.agreedMustFixCandidates).toEqual(["sonnet46: MUST_FIX: Blocked quorum is ambiguous"]);
      expect(debate.otherFindingCandidates).toContain("sonnet46: SHOULD_FIX: tighten docs");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
