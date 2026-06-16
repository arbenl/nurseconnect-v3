import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { run } from "../check.mjs";

describe("enterprise gate inline manifest maps", () => {
  it("accepts documented inline gate map syntax", () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-ent-gates-inline-"));
    const manifest = join(root, "slice-gates.yaml");
    const config = join(root, "ent-gate-paths.json");
    writeFileSync(config, JSON.stringify({ gates: { "ent-tm": [], "ent-dlv": [], "ent-perf": [] } }));
    writeFileSync(manifest, [
      "slice: NC-EG-01",
      "branch: codex/ent-gate-framework",
      "gates:",
      "  ent-tm: { status: n/a, justification: Threat model paths are not touched by this fixture. }",
      "  ent-dlv: { status: n/a, justification: Data lifecycle is not touched by this fixture. }",
      "  ent-perf: { status: n/a, justification: Performance is not touched by this fixture. }",
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
        "--config",
        config,
        "--changed-file",
        "docs/example.md",
      ], {});
      expect(result).toMatchObject({ status: "pass", errors: [] });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
