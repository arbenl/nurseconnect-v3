import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const scriptPath = join(repoRoot, "scripts/multi-agent/model-review.mjs");

function tempRun() {
  const root = mkdtempSync(join(tmpdir(), "nurseconnect-model-review-"));
  const packet = join(root, "packet.md");
  writeFileSync(packet, "# Slice Design\n\nReview NC-E0-01 identity bridge.");
  return { root, packet };
}

describe("model-review runner", () => {
  it("generates dry-run review receipts for selected reviewers", () => {
    const { root, packet } = tempRun();
    try {
      execFileSync("node", [scriptPath, "--packet", packet, "--run-root", root, "--reviewers", "claude,copilot", "--dry-run"], { cwd: repoRoot });
      const manifest = JSON.parse(readFileSync(join(root, "reviews/model-review-manifest.json"), "utf8"));
      const claude = readFileSync(join(root, "reviews/claude.md"), "utf8");
      const copilot = readFileSync(join(root, "reviews/copilot.md"), "utf8");
      expect(manifest.reviewers).toEqual(["claude", "copilot"]);
      expect(manifest.results[0].model).toBe("claude-sonnet-4-6");
      expect(manifest.results[1].args).toEqual(expect.arrayContaining(["claude-sonnet-4.6", "low", "--no-remote", "--no-ask-user", "--stream"]));
      expect(claude).toContain("dry-run");
      expect(copilot).toContain("Copilot Pro+ Sonnet 4.6");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("defaults to the enterprise reviewer route ladder", () => {
    const { root, packet } = tempRun();
    try {
      execFileSync("node", [scriptPath, "--packet", packet, "--run-root", root, "--dry-run"], { cwd: repoRoot });
      const manifest = JSON.parse(readFileSync(join(root, "reviews/model-review-manifest.json"), "utf8"));
      expect(manifest.reviewers).toEqual(["claude48", "claude47", "sonnet46", "gemini", "copilot"]);
      expect(manifest.results.map((result) => result.model)).toEqual(["claude-opus-4-5", "claude-sonnet-4-6", "claude-sonnet-4-6", "gemini-3.1-pro-preview", "claude-sonnet-4.6"]);
      expect(readFileSync(join(root, "reviews/claude48.md"), "utf8")).toContain("Claude 4.8 enterprise architecture review");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("generates debate synthesis receipts when requested", () => {
    const { root, packet } = tempRun();
    try {
      execFileSync("node", [scriptPath, "--packet", packet, "--run-root", root, "--reviewers", "codex,claude", "--debate", "--dry-run"], { cwd: repoRoot });
      const manifest = JSON.parse(readFileSync(join(root, "reviews/model-review-manifest.json"), "utf8"));
      const debate = readFileSync(join(root, "reviews/debate.md"), "utf8");
      expect(manifest.reviewers).toEqual(["codex", "claude"]);
      expect(manifest.debate).toBe(true);
      expect(debate).toContain("Model Critique Debate");
      expect(debate).toContain("READY IF DETERMINISTIC GATES PASS");
      expect(debate).toContain("completed: `none`");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails closed when a packet contains likely secrets or PHI", () => {
    const { root, packet } = tempRun();
    writeFileSync(packet, "DATABASE_URL=postgres://user:pass@localhost/db");
    try {
      const result = spawnSync("node", [scriptPath, "--packet", packet, "--run-root", root, "--dry-run"], { cwd: repoRoot, encoding: "utf8" });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("sensitive patterns");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects unknown reviewer routes", () => {
    const { root, packet } = tempRun();
    try {
      const result = spawnSync("node", [scriptPath, "--packet", packet, "--run-root", root, "--reviewers", "claude,unknown", "--dry-run"], { cwd: repoRoot, encoding: "utf8" });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("unknown reviewer route");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
