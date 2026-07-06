import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { run } from "../check.mjs";

describe("enterprise gate tracker promotion checks", () => {
  it("fails closed when tracker promotion changes without a base tracker", () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-ent-gates-tracker-"));
    try {
      const result = run([
        "--base",
        "HEAD",
        "--enforce-promotion",
        "true",
        "--run-root",
        root,
        "--changed-file",
        "docs/plans/current-tracker.md",
      ], {});
      expect(result.errors.join("\n")).toContain("base tracker is unavailable");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not exempt pull requests whose source branch is named main", () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-ent-gates-tracker-"));
    try {
      const result = run([
        "--base",
        "HEAD",
        "--run-root",
        root,
        "--changed-file",
        "docs/plans/current-tracker.md",
      ], { GITHUB_HEAD_REF: "main", GITHUB_BASE_REF: "main" });
      expect(result.errors.join("\n")).toContain("base tracker is unavailable");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("uses the base tracker for promotion even when the PR tracker is unchanged", () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-ent-gates-tracker-"));
    try {
      const result = run([
        "--base",
        "HEAD",
        "--run-root",
        root,
        "--changed-file",
        "docs/example.md",
      ], { GITHUB_BASE_REF: "main" });
      expect(result.errors.join("\n")).toContain("base tracker is unavailable");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("can validate policy against the current base while diffing from merge-base", () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-ent-gates-tracker-"));
    try {
      const manifest = join(root, "slice-gates.yaml");
      writeFileSync(manifest, [
        "slice: NC-TB-01",
        "branch: codex/tenant-expand",
        "gates:",
        "  ent-tm:",
        "    status: required",
        "    evidence: docs/threat-models/nc-tb-01-fable5-advisory.md",
        "  ent-dlv: { status: n/a, justification: No schema or data lifecycle behavior changes in this test fixture. }",
        "  ent-perf: { status: n/a, justification: No runtime or performance budget behavior changes in this test fixture. }",
        "",
      ].join("\n"));
      const result = run([
        "--base",
        "HEAD",
        "--policy-base",
        "origin/main",
        "--manifest",
        manifest,
        "--run-root",
        root,
        "--changed-files-complete",
        "true",
        "--changed-file",
        "docs/example.md",
        "--changed-file",
        "docs/threat-models/nc-tb-01-fable5-advisory.md",
      ], { GITHUB_BASE_REF: "main" });
      expect(result.errors).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
