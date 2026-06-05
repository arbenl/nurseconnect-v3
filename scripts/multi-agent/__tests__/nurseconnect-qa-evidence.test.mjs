import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { repoRoot } from "./slice-evidence-helpers.mjs";

describe("nurseconnect QA evidence collector", () => {
  it("fails clearly when RUN_ROOT is missing", () => {
    const result = spawnSync("node", [join(repoRoot, "scripts/multi-agent/nurseconnect-qa-evidence.mjs")], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, RUN_ROOT: "" },
    });

    expect(result.status).toBe(64);
    expect(result.stderr).toContain("RUN_ROOT is required");
  });
});
