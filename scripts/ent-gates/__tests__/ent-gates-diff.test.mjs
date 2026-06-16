import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { run } from "../check.mjs";

function tempRoot() {
  return mkdtempSync(join(tmpdir(), "nurseconnect-ent-gates-"));
}

function writeManifest(path) {
  writeFileSync(path, [
    "slice: NC-EG-01",
    "branch: codex/ent-gate-framework",
    "gates:",
    "  ent-tm:",
    "    status: required",
    "    evidence: docs/threat-models/nc-eg-01.md",
    "  ent-dlv:",
    "    status: n/a",
    "    justification: Data lifecycle paths are not touched by this fixture.",
    "  ent-perf:",
    "    status: n/a",
    "    justification: Performance paths are not touched by this fixture.",
  ].join("\n"));
}

describe("enterprise gate changed-file collection", () => {
  it("fails closed when base diff is unavailable and explicit files are not complete", () => {
    const root = tempRoot();
    const manifest = join(root, "slice-gates.yaml");
    writeManifest(manifest);

    try {
      const result = run([
        "--base",
        "refs/heads/definitely-missing-ent-gate-base",
        "--enforce-promotion",
        "false",
        "--run-root",
        root,
        "--manifest",
        manifest,
        "--changed-file",
        "docs/example.md",
      ], {});
      expect(result.status).toBe("fail");
      expect(result.errors.join("\n")).toContain("Unable to collect changed files");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("allows missing base diff only with explicit complete changed files", () => {
    const root = tempRoot();
    const manifest = join(root, "slice-gates.yaml");
    const config = join(root, "ent-gate-paths.json");
    writeManifest(manifest);
    writeFileSync(config, JSON.stringify({ gates: { "ent-tm": [], "ent-dlv": [], "ent-perf": [] } }));

    try {
      const result = run([
        "--base",
        "refs/heads/definitely-missing-ent-gate-base",
        "--enforce-promotion",
        "false",
        "--run-root",
        root,
        "--manifest",
        manifest,
        "--config",
        config,
        "--changed-files-complete",
        "--changed-file",
        "docs/example.md",
      ], {});
      expect(result.status).toBe("pass");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not let complete-file mode bootstrap changed gate policy without a base ref", () => {
    const root = tempRoot();
    const manifest = join(root, "slice-gates.yaml");
    const config = join(root, "ent-gate-paths.json");
    writeManifest(manifest);
    writeFileSync(config, JSON.stringify({ gates: { "ent-tm": [], "ent-dlv": [], "ent-perf": [] } }));

    try {
      const result = run([
        "--base",
        "refs/heads/definitely-missing-ent-gate-base",
        "--enforce-promotion",
        "false",
        "--run-root",
        root,
        "--manifest",
        manifest,
        "--config",
        config,
        "--changed-files-complete",
        "--changed-file",
        config,
      ], {});
      expect(result.status).toBe("fail");
      expect(result.errors.join("\n")).toContain("Unable to load base gate paths");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
