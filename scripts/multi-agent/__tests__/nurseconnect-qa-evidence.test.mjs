import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
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

  it("records repo-owned nurse QA MCP identity", () => {
    const runRoot = mkdtempSync(join(tmpdir(), "nurseconnect-qa-evidence-"));
    try {
      const result = spawnSync("node", [join(repoRoot, "scripts/multi-agent/nurseconnect-qa-evidence.mjs")], {
        cwd: repoRoot,
        encoding: "utf8",
        env: { ...process.env, RUN_ROOT: runRoot, BASE_REF: "HEAD" },
      });
      const payload = JSON.parse(readFileSync(join(runRoot, "evidence/nurseconnect-qa.json"), "utf8"));

      expect(result.status).toBe(0);
      expect(payload.mcpIdentity.effective).toBe("nurseconnect_qa");
      expect(payload.mcpIdentity.owned).toEqual(expect.arrayContaining(["nurseconnect_qa", "nurse_qa"]));
      expect(payload.mcpIdentity.configured).toEqual(expect.arrayContaining(["nurseconnect_qa", "nurse_qa"]));
      expect(payload.mcpIdentity.forbidden).toContain("interdomestik_qa");
    } finally {
      rmSync(runRoot, { recursive: true, force: true });
    }
  });

  it("fails forbidden runtime QA identity overrides", () => {
    const runRoot = mkdtempSync(join(tmpdir(), "nurseconnect-qa-evidence-"));
    try {
      const result = spawnSync("node", [join(repoRoot, "scripts/multi-agent/nurseconnect-qa-evidence.mjs")], {
        cwd: repoRoot,
        encoding: "utf8",
        env: { ...process.env, RUN_ROOT: runRoot, QA_IDENTITY: "interdomestik_qa" },
      });
      const payload = JSON.parse(readFileSync(join(runRoot, "evidence/nurseconnect-qa.json"), "utf8"));

      expect(result.status).toBe(2);
      expect(payload.blocker).toContain("runtime QA identity is forbidden");
    } finally {
      rmSync(runRoot, { recursive: true, force: true });
    }
  });
});
