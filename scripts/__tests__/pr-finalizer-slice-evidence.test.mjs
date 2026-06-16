import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

describe("PR finalizer slice evidence wrapper", () => {
  it("marks GitHub PR file metadata as complete for ent-gate validation", () => {
    const script = readFileSync(join(repoRoot, "scripts/pr-finalizer-slice-evidence.mjs"), "utf8");
    expect(script).toContain('spawnSync("gh", ["pr", "diff", String(number), "--name-only"]');
    expect(script).toContain("Failed to fetch PR base ref");
    expect(script).toContain("PR_FILES_JSON: JSON.stringify(completeFiles.files)");
    expect(script).toContain("PR_FILES_COMPLETE: completeFiles.complete");
    expect(script).toContain("result.status === null");
  });
});
