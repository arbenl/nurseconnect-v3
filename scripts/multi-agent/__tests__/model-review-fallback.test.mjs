import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const scriptPath = join(repoRoot, "scripts/multi-agent/model-review.mjs");

function tempRun() {
  const root = mkdtempSync(join(tmpdir(), "nurseconnect-model-fallback-"));
  const packet = join(root, "packet.md");
  const binDir = join(root, "bin");
  mkdirSync(binDir, { recursive: true });
  writeFileSync(packet, "# Slice Design\n\nReview non-sensitive tooling changes.");
  return { root, packet, binDir, env: { ...process.env, PATH: `${binDir}:/usr/bin:/bin` } };
}

function fakeCli(binDir, command, body) {
  const cliPath = join(binDir, command);
  writeFileSync(cliPath, ["#!/usr/bin/env sh", body, ""].join("\n"));
  chmodSync(cliPath, 0o755);
}

describe("model-review fallback ladder", () => {
  it("falls through blocked Claude routes to Gemini", () => {
    const { root, packet, binDir, env } = tempRun();
    try {
      fakeCli(binDir, "claude", "echo quota exhausted >&2\nexit 1");
      fakeCli(binDir, "gemini", "echo GEMINI_OK\nexit 0");

      execFileSync(process.execPath, [scriptPath, "--packet", packet, "--run-root", root, "--reviewers", "claude48,sonnet46,gemini", "--fallback-ladder"], { cwd: repoRoot, env });

      const manifest = JSON.parse(readFileSync(join(root, "reviews/model-review-manifest.json"), "utf8"));
      expect(manifest.fallback).toMatchObject({
        enabled: true,
        attempted: ["claude48", "sonnet46", "gemini"],
        skipped: [],
        winner: "gemini",
        exhausted: false,
      });
      expect(manifest.results.map((result) => result.status)).toEqual(["blocked", "blocked", "complete"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("exits nonzero when every fallback route is blocked", () => {
    const { root, packet, binDir, env } = tempRun();
    try {
      fakeCli(binDir, "claude", "echo quota exhausted >&2\nexit 1");
      fakeCli(binDir, "gemini", "echo quota exhausted >&2\nexit 1");

      const result = spawnSync(process.execPath, [scriptPath, "--packet", packet, "--run-root", root, "--reviewers", "claude48,gemini", "--fallback-ladder"], { cwd: repoRoot, encoding: "utf8", env });
      const manifest = JSON.parse(readFileSync(join(root, "reviews/model-review-manifest.json"), "utf8"));

      expect(result.status).toBe(1);
      expect(manifest.fallback.winner).toBeNull();
      expect(manifest.fallback.exhausted).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
