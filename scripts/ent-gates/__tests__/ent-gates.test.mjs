import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { run } from "../check.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

function tempRoot() {
  return mkdtempSync(join(tmpdir(), "nurseconnect-ent-gates-"));
}

function runGate(args) {
  return run(["--base", "HEAD", "--enforce-promotion", "false", ...args], {});
}

describe("enterprise gate manifest", () => {
  it("fails closed when slice-gates.yaml is missing", () => {
    const root = tempRoot();
    try {
      const result = runGate([
        "--run-root",
        root,
        "--manifest",
        join(root, "missing.yaml"),
        "--changed-file",
        "docs/example.md",
      ]);
      expect(result.status).toBe("fail");
      expect(result.errors.join("\n")).toContain("Missing gate manifest");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects n/a declarations without explicit justification", () => {
    const root = tempRoot();
    const manifest = join(root, "slice-gates.yaml");
    const config = join(root, "ent-gate-paths.json");
    writeFileSync(config, JSON.stringify({ gates: { "ent-tm": ["apps/**"], "ent-dlv": [], "ent-perf": [] } }));
    writeFileSync(manifest, [
      "slice: NC-EG-01",
      "branch: codex/ent-gate-framework",
      "gates:",
      "  ent-tm:",
      "    status: n/a",
      "    justification: too short",
      "  ent-dlv:",
      "    status: n/a",
      "    justification: Data lifecycle is not touched by this docs example.",
      "  ent-perf:",
      "    status: n/a",
      "    justification: Performance surfaces are not touched by this docs example.",
    ].join("\n"));

    try {
      const result = runGate(["--run-root", root, "--manifest", manifest, "--config", config, "--changed-file", "docs/example.md"]);
      expect(result.status).toBe("fail");
      expect(result.errors).toContain("ent-tm n/a justification must be at least 20 chars.");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects guarded-path changes when their mapped gate is n/a", () => {
    const root = tempRoot();
    const manifest = join(root, "slice-gates.yaml");
    writeFileSync(manifest, [
      "slice: NC-EG-01",
      "branch: codex/ent-gate-framework",
      "gates:",
      "  ent-tm:",
      "    status: n/a",
      "    justification: This deliberately invalid test declaration has enough text.",
      "  ent-dlv:",
      "    status: n/a",
      "    justification: Data lifecycle is not touched by this test fixture.",
      "  ent-perf:",
      "    status: n/a",
      "    justification: Performance surfaces are not touched by this test fixture.",
    ].join("\n"));

    try {
      const result = runGate([
        "--run-root",
        root,
        "--manifest",
        manifest,
        "--config",
        join(repoRoot, "config/ent-gate-paths.json"),
        "--changed-file",
        "scripts/ent-gates/check.mjs",
      ]);
      expect(result.status).toBe("fail");
      expect(result.errors.join("\n")).toContain("ent-tm cannot be n/a");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts folded YAML justifications for docs-only n/a gates", () => {
    const root = tempRoot();
    const manifest = join(root, "slice-gates.yaml");
    const config = join(root, "ent-gate-paths.json");
    writeFileSync(config, JSON.stringify({ gates: { "ent-tm": ["apps/**"], "ent-dlv": [], "ent-perf": [] } }));
    writeFileSync(manifest, [
      "slice: NC-EG-01",
      "branch: codex/ent-gate-framework",
      "gates:",
      "  ent-tm:",
      "    status: n/a",
      "    justification: >-",
      "      Docs-only fixture with a sufficiently explicit threat-model",
      "      justification and no guarded path changes.",
      "  ent-dlv:",
      "    status: n/a",
      "    justification: >-",
      "      Data lifecycle is not touched by this docs-only fixture.",
      "  ent-perf:",
      "    status: n/a",
      "    justification: >-",
      "      Performance surfaces are not touched by this docs-only fixture.",
    ].join("\n"));

    try {
      const result = runGate(["--run-root", root, "--manifest", manifest, "--config", config, "--changed-files-complete", "true", "--changed-file", "docs/example.md"]);
      expect(result).toMatchObject({ status: "pass", errors: [] });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
