import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const scriptPath = join(repoRoot, "scripts/multi-agent/model-review.mjs");

describe("model-review runner", () => {
  it("generates dry-run review receipts for selected reviewers", () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-model-review-"));
    const packet = join(root, "packet.md");
    writeFileSync(packet, "# Slice Design\n\nReview NC-E0-01 identity bridge.");

    try {
      execFileSync("node", [
        scriptPath,
        "--packet",
        packet,
        "--run-root",
        root,
        "--reviewers",
        "claude,copilot",
        "--dry-run",
      ], { cwd: repoRoot });

      const manifest = JSON.parse(
        readFileSync(join(root, "reviews/model-review-manifest.json"), "utf8")
      );
      const claude = readFileSync(join(root, "reviews/claude.md"), "utf8");
      const copilot = readFileSync(join(root, "reviews/copilot.md"), "utf8");

      expect(manifest.reviewers).toEqual(["claude", "copilot"]);
      expect(manifest.results[1].args).toContain("claude-sonnet-4.6");
      expect(manifest.results[1].args).toContain("low");
      expect(manifest.results[1].args).toContain("--no-remote");
      expect(manifest.results[1].args).toContain("--no-ask-user");
      expect(manifest.results[1].args).toContain("--stream");
      expect(claude).toContain("dry-run");
      expect(copilot).toContain("Copilot Pro+ Sonnet 4.6");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails closed when a packet contains likely secrets or PHI", () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-model-review-"));
    const packet = join(root, "packet.md");
    writeFileSync(packet, "DATABASE_URL=postgres://user:pass@localhost/db");

    try {
      const result = spawnSync("node", [
        scriptPath,
        "--packet",
        packet,
        "--run-root",
        root,
        "--dry-run",
      ], { cwd: repoRoot, encoding: "utf8" });

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("sensitive patterns");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects unknown reviewer routes", () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-model-review-"));
    const packet = join(root, "packet.md");
    writeFileSync(packet, "Safe minimized review packet.");

    try {
      const result = spawnSync("node", [
        scriptPath,
        "--packet",
        packet,
        "--run-root",
        root,
        "--reviewers",
        "claude,unknown",
        "--dry-run",
      ], { cwd: repoRoot, encoding: "utf8" });

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("unknown reviewer route");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
