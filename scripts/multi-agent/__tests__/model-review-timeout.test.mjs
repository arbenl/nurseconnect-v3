import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { describe, expect, it } from "vitest";

import { runRoute } from "../lib/model-review-runner.mjs";

function fakeCopilot(binDir, marker) {
  const cliPath = join(binDir, "copilot");
  writeFileSync(
    cliPath,
    [
      "#!/usr/bin/env sh",
      `echo alive >> "${marker}"`,
      "while :; do",
      `  echo alive >> "${marker}"`,
      "  sleep 0.2",
      "done &",
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

    try {
      mkdirSync(binDir, { recursive: true });
      writeFileSync(marker, "");
      fakeCopilot(binDir, marker);

      const env = { PATH: `${binDir}:/usr/bin:/bin`, MODEL_REVIEW_TIMEOUT_MS: "500" };
      const result = await runRoute("copilot", "non-sensitive timeout probe", { rawPrompt: true, env }, root);
      const afterTimeout = readFileSync(marker, "utf8");
      await delay(700);
      const afterDelay = readFileSync(marker, "utf8");

      expect(result.status).toBe("blocked");
      expect(result.stderr).toContain("killed reviewer process group");
      expect(afterTimeout.length).toBeGreaterThan(0);
      expect(afterDelay).toBe(afterTimeout);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
