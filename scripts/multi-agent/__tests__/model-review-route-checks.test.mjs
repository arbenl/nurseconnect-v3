import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const scriptPath = join(repoRoot, "scripts/multi-agent/model-review.mjs");

function fakeCli(binDir, command, body = "echo MODEL_ROUTE_OK\nexit 0") {
  const cliPath = join(binDir, command);
  writeFileSync(cliPath, ["#!/usr/bin/env sh", "if [ \"$1\" = \"--version\" ]; then", `echo "${command} 1.0.0"`, "exit 0", "fi", body, ""].join("\n"));
  chmodSync(cliPath, 0o755);
}

function tempWithBin() {
  const root = mkdtempSync(join(tmpdir(), "nurseconnect-model-review-"));
  const binDir = join(root, "bin");
  mkdirSync(binDir, { recursive: true });
  return { root, binDir, env: { ...process.env, PATH: `${binDir}:/usr/bin:/bin` } };
}

describe("model-review route checks", () => {
  it("writes route preflight evidence for callable reviewers", () => {
    const { root, binDir, env } = tempWithBin();
    try {
      ["claude", "gemini", "copilot"].forEach((command) => fakeCli(binDir, command));
      execFileSync(process.execPath, [scriptPath, "--preflight", "--run-root", root, "--reviewers", "claude48,gemini,copilot"], { cwd: repoRoot, env });
      const report = JSON.parse(readFileSync(join(root, "reviews/model-review-preflight.json"), "utf8"));
      const markdown = readFileSync(join(root, "reviews/model-review-preflight.md"), "utf8");
      expect(report.status).toBe("pass");
      expect(report.results.map((result) => result.model)).toEqual(["claude-opus-4-5", "gemini-3.1-pro-preview", "claude-sonnet-4.6"]);
      expect(markdown).toContain("Model Review Route Preflight");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails route preflight evidence when a reviewer command is blocked", () => {
    const { root, binDir, env } = tempWithBin();
    try {
      fakeCli(binDir, "claude");
      const result = spawnSync(process.execPath, [scriptPath, "--preflight", "--run-root", root, "--reviewers", "claude48,gemini"], { cwd: repoRoot, encoding: "utf8", env });
      const report = JSON.parse(readFileSync(join(root, "reviews/model-review-preflight.json"), "utf8"));
      expect(result.status).toBe(1);
      expect(report.results.find((item) => item.reviewer === "gemini").status).toBe("blocked");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("writes and fails model access-check evidence based on route answers", () => {
    const passRun = tempWithBin();
    try {
      ["claude", "gemini", "copilot"].forEach((command) => fakeCli(passRun.binDir, command));
      execFileSync(process.execPath, [scriptPath, "--access-check", "--run-root", passRun.root, "--reviewers", "claude48,gemini,copilot"], { cwd: repoRoot, env: passRun.env });
      const report = JSON.parse(readFileSync(join(passRun.root, "reviews/model-review-access.json"), "utf8"));
      expect(report.completed).toEqual(["claude48", "gemini", "copilot"]);
    } finally {
      rmSync(passRun.root, { recursive: true, force: true });
    }

    const failRun = tempWithBin();
    try {
      fakeCli(failRun.binDir, "claude", "echo \"model unavailable\"\nexit 1");
      const result = spawnSync(process.execPath, [scriptPath, "--access-check", "--run-root", failRun.root, "--reviewers", "claude48"], { cwd: repoRoot, encoding: "utf8", env: failRun.env });
      const report = JSON.parse(readFileSync(join(failRun.root, "reviews/model-review-access.json"), "utf8"));
      const markdown = readFileSync(join(failRun.root, "reviews/model-review-access.md"), "utf8");
      expect(result.status).toBe(1);
      expect(report.blocked[0].reviewer).toBe("claude48");
      expect(report.blocked[0].remediation.overrideEnv).toBe("CLAUDE_48_REVIEW_MODEL");
      expect(markdown).toContain("Set CLAUDE_48_REVIEW_MODEL");
    } finally {
      rmSync(failRun.root, { recursive: true, force: true });
    }
  });
});
