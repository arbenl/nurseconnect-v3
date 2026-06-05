import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { describe, expect, it } from "vitest";

import { runRoute } from "../lib/model-review-runner.mjs";

async function waitForMarker(marker, minLength = 1) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const current = readFileSync(marker, "utf8");
    if (current.length >= minLength) return current;
    await delay(50);
  }
  return readFileSync(marker, "utf8");
}

async function waitForPid(pidFile) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const pid = Number(readFileSync(pidFile, "utf8").trim());
    if (Number.isInteger(pid) && pid > 0) return pid;
    await delay(50);
  }
  return Number(readFileSync(pidFile, "utf8").trim());
}

async function waitForPidGone(pid) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!isAlive(pid)) return true;
    await delay(50);
  }
  return !isAlive(pid);
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function fakeCopilot(binDir, marker, pidFile) {
  const cliPath = join(binDir, "copilot");
  writeFileSync(
    cliPath,
    [
      "#!/usr/bin/env sh",
      `echo alive >> "${marker}"`,
      "(while :; do",
      "  sleep 1",
      `  echo alive >> "${marker}"`,
      "done) &",
      `echo $! > "${pidFile}"`,
      "wait",
      "",
    ].join("\n")
  );
  chmodSync(cliPath, 0o755);
}

describe("model-review route timeout cleanup", () => {
  it("kills descendant reviewer processes on timeout", async () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-model-timeout-"));
    const binDir = join(root, "bin");
    const marker = join(root, "marker.txt");
    const pidFile = join(root, "child.pid");

    try {
      mkdirSync(binDir, { recursive: true });
      writeFileSync(marker, "");
      writeFileSync(pidFile, "");
      fakeCopilot(binDir, marker, pidFile);

      const env = { PATH: `${binDir}:/usr/bin:/bin`, MODEL_REVIEW_TIMEOUT_MS: "2500" };
      const pending = runRoute("copilot", "non-sensitive timeout probe", { rawPrompt: true, env }, root);
      const beforeTimeout = await waitForMarker(marker, 12);
      const childPid = await waitForPid(pidFile);
      const result = await pending;
      const afterTimeout = readFileSync(marker, "utf8");
      const childGone = await waitForPidGone(childPid);

      expect(result.status).toBe("blocked");
      expect(result.exitCode).toBe(-1);
      expect(result.stderr).toContain("killed reviewer process group");
      expect(beforeTimeout.length).toBeGreaterThan(0);
      expect(afterTimeout.length).toBeGreaterThan(beforeTimeout.length);
      expect(childGone).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
