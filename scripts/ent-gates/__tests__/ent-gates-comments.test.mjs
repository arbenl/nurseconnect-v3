import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { run } from "../check.mjs";

describe("enterprise gate manifest comments", () => {
  it("accepts full-line YAML comments", () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-ent-gates-comments-"));
    const manifest = join(root, "slice-gates.yaml");
    const config = join(root, "ent-gate-paths.json");
    writeFileSync(config, JSON.stringify({ gates: { "ent-tm": ["apps/**"], "ent-dlv": [], "ent-perf": [] } }));
    writeFileSync(manifest, [
      "# comment",
      "slice: NC-EG-01",
      "branch: codex/ent-gate-framework",
      "gates:",
      "  ent-tm:",
      "    status: n/a",
      "    justification: Docs-only fixture with no guarded path changes.",
      "  ent-dlv:",
      "    status: n/a",
      "    justification: Data lifecycle is not touched by this fixture.",
      "  ent-perf:",
      "    status: n/a",
      "    justification: Performance surfaces are not touched by this fixture.",
    ].join("\n"));

    try {
      const result = run(["--base", "HEAD", "--enforce-promotion", "false", "--run-root", root, "--manifest", manifest, "--config", config, "--changed-files-complete", "true", "--changed-file", "docs/example.md"], {});
      expect(result).toMatchObject({ status: "pass", errors: [] });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
