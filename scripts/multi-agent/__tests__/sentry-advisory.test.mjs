import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const scriptPath = join(repoRoot, "scripts/multi-agent/sentry-advisory.mjs");

describe("sentry advisory", () => {
  it("records missing config as non-blocking evidence", () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-sentry-"));
    try {
      const result = spawnSync("node", [scriptPath, "--run-root", root], {
        cwd: repoRoot,
        encoding: "utf8",
        env: { PATH: process.env.PATH },
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("MISSING_CONFIG");
      expect(readFileSync(join(root, "evidence/sentry/sentry-summary.md"), "utf8")).toContain(
        "MISSING_CONFIG"
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails missing config in strict mode", () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-sentry-"));
    try {
      const result = spawnSync("node", [scriptPath, "--run-root", root, "--strict"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: { PATH: process.env.PATH },
      });
      expect(result.status).not.toBe(0);
      expect(result.stdout).toContain("MISSING_CONFIG");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("forbids advisory mode in CI", () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-sentry-"));
    try {
      const result = spawnSync("node", [scriptPath, "--run-root", root], {
        cwd: repoRoot,
        encoding: "utf8",
        env: { PATH: process.env.PATH, CI: "1", SENTRY_ADVISORY_MODE: "advisory" },
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("advisory mode is forbidden in CI");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("blocks accidental Interdomestik Sentry configuration", () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-sentry-"));
    try {
      const result = spawnSync("node", [scriptPath, "--run-root", root], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          PATH: process.env.PATH,
          SENTRY_AUTH_TOKEN: "token",
          SENTRY_ORG: "human-p5",
          SENTRY_PROJECT: "interdmestik-nextjs",
        },
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("forbidden Interdomestik");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
