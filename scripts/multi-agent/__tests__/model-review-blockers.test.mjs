import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runRoute, writeReceipt } from "../lib/model-review-runner.mjs";

function fakeSilentCopilot(binDir) {
  const cliPath = join(binDir, "copilot");
  writeFileSync(cliPath, ["#!/usr/bin/env sh", "exit 0", ""].join("\n"));
  chmodSync(cliPath, 0o755);
}

describe("model-review blocked route classification", () => {
  it("blocks silent reviewer success instead of counting it as approval", async () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-model-silent-"));
    const binDir = join(root, "bin");

    try {
      mkdirSync(binDir, { recursive: true });
      fakeSilentCopilot(binDir);

      const env = { PATH: `${binDir}:/usr/bin:/bin`, MODEL_REVIEW_TIMEOUT_MS: "2500" };
      const result = await runRoute("copilot", "non-sensitive silent probe", { rawPrompt: true, env }, root);

      expect(result.status).toBe("blocked");
      expect(result.exitCode).toBe(0);
      expect(result.blockerReason).toBe("timeout_or_no_output");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not classify spawn errors as timeouts", async () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-model-spawn-"));
    const binDir = join(root, "bin");

    try {
      mkdirSync(binDir, { recursive: true });
      const env = { PATH: binDir, MODEL_REVIEW_TIMEOUT_MS: "2500" };
      const result = await runRoute("copilot", "non-sensitive spawn probe", { rawPrompt: true, env }, root);

      expect(result.status).toBe("blocked");
      expect(result.exitCode).toBe(-1);
      expect(result.blockerReason).toBe("route_exit_nonzero");
      expect(result.stderr).toContain("ENOENT");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves intentional receipt blank lines", () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-model-receipt-"));

    try {
      writeReceipt(root, {
        reviewer: "copilot",
        status: "blocked",
        blockerReason: "timeout_or_no_output",
        label: "Copilot",
        provider: "github",
        model: "sonnet",
        role: "reviewer",
        command: "copilot",
        args: [],
        stdout: "",
        stderr: "",
        exitCode: 0,
      });

      const receipt = readFileSync(join(root, "copilot.md"), "utf8");
      expect(receipt).toContain("# copilot Review\n\n- status");
      expect(receipt).toContain("## stdout\n\n\n## stderr");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
