import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { defaultReviewers } from "../multi-agent/lib/model-review-routes.mjs";

const strictRoutes = "sonnet46,gemini";

function read(path) {
  return readFileSync(path, "utf8");
}

function reviewerLines(text) {
  return text.split(/\r?\n/).filter((line) => line.includes("--require-reviewers"));
}

describe("slice playbook reviewer route convergence", () => {
  it("keeps strict reviewer routes aligned across parser, template, and runbooks", () => {
    expect(defaultReviewers.join(",")).toBe(strictRoutes);

    expect(read("scripts/lib/pr-slice-evidence.mjs")).toContain('"sonnet46", "gemini"');

    const files = [
      "scripts/__tests__/pr-slice-evidence-helpers.mjs",
      ".github/PULL_REQUEST_TEMPLATE.md",
      "docs/runbooks/slice_workflow.md",
      "docs/runbooks/nurseconnect-slice-runner-skill.md",
      "docs/runbooks/slice_playbook_scorecard.md",
      "docs/runbooks/plugin_activation_policy.md",
    ];

    for (const file of files) {
      const text = read(file);
      expect(text, file).toContain(strictRoutes);
      for (const line of reviewerLines(text)) {
        expect(line, `${file}: ${line}`).not.toMatch(/\bcopilot\b/i);
        expect(line, `${file}: ${line}`).toContain(strictRoutes);
      }
    }
  });
});
