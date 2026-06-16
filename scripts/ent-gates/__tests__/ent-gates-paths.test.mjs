import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { run } from "../check.mjs";

function tempRoot() {
  return mkdtempSync(join(tmpdir(), "nurseconnect-ent-gates-"));
}

describe("enterprise gate guarded path coverage", () => {
  it("requires threat-model evidence for server payment helpers", () => {
    const root = tempRoot();
    const manifest = join(root, "slice-gates.yaml");
    writeFileSync(manifest, [
      "slice: NC-EG-01",
      "branch: codex/ent-gate-framework",
      "gates:",
      "  ent-tm:",
      "    status: n/a",
      "    justification: This deliberately invalid fixture touches payment helpers.",
      "  ent-dlv:",
      "    status: n/a",
      "    justification: Data lifecycle is not touched by this fixture.",
      "  ent-perf:",
      "    status: n/a",
      "    justification: Performance surfaces are not touched by this fixture.",
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
        "apps/web/src/server/payments/admin-payment-trace.ts",
      ], {});
      expect(result.errors.join("\n")).toContain("ent-tm cannot be n/a");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("requires threat-model evidence for database RLS helpers", () => {
    const root = tempRoot();
    const manifest = join(root, "slice-gates.yaml");
    writeFileSync(manifest, [
      "slice: NC-EG-01",
      "branch: codex/ent-gate-framework",
      "gates:",
      "  ent-tm:",
      "    status: n/a",
      "    justification: This deliberately invalid fixture touches RLS helpers.",
      "  ent-dlv:",
      "    status: n/a",
      "    justification: Data lifecycle is not touched by this fixture.",
      "  ent-perf:",
      "    status: n/a",
      "    justification: Performance surfaces are not touched by this fixture.",
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
        "packages/database/src/rls-role-assertion.ts",
      ], {});
      expect(result.errors.join("\n")).toContain("ent-tm cannot be n/a");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("requires threat-model evidence for multi-agent gate helpers", () => {
    const root = tempRoot();
    const manifest = join(root, "slice-gates.yaml");
    writeFileSync(manifest, [
      "slice: NC-EG-01",
      "branch: codex/ent-gate-framework",
      "gates:",
      "  ent-tm:",
      "    status: n/a",
      "    justification: This deliberately invalid fixture touches gate helpers.",
      "  ent-dlv:",
      "    status: n/a",
      "    justification: Data lifecycle is not touched by this fixture.",
      "  ent-perf:",
      "    status: n/a",
      "    justification: Performance surfaces are not touched by this fixture.",
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
        "scripts/multi-agent/slice-evidence.mjs",
      ], {});
      expect(result.errors.join("\n")).toContain("ent-tm cannot be n/a");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
