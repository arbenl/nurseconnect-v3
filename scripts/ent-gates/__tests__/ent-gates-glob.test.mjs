import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { run } from "../check.mjs";

function tempRoot() {
  return mkdtempSync(join(tmpdir(), "nurseconnect-ent-gates-"));
}

describe("enterprise gate glob matching", () => {
  it("matches globstar direct child files", () => {
    const root = tempRoot();
    const manifest = join(root, "slice-gates.yaml");
    writeFileSync(manifest, [
      "slice: NC-EG-01",
      "branch: codex/ent-gate-framework",
      "gates:",
      "  ent-tm:",
      "    status: n/a",
      "    justification: This fixture does not touch threat-model paths.",
      "  ent-dlv:",
      "    status: n/a",
      "    justification: This deliberately invalid fixture touches SQL.",
      "  ent-perf:",
      "    status: n/a",
      "    justification: Performance surfaces are not touched.",
    ].join("\n"));

    try {
      const result = run([
        "--base",
        "HEAD",
        "--enforce-promotion",
        "false",
        "--run-root",
        root,
        "--manifest",
        manifest,
        "--changed-file",
        "packages/database/bootstrap.sql",
      ], {});
      expect(result.errors.join("\n")).toContain("ent-dlv cannot be n/a");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
