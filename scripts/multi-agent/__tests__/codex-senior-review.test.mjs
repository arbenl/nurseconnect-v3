import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { repoRoot } from "./slice-evidence-helpers.mjs";

const script = join(repoRoot, "scripts/multi-agent/codex-senior-review.mjs");

function makeTemp() {
  const root = mkdtempSync(join(tmpdir(), "codex-senior-review-"));
  mkdirSync(join(root, "bin"));
  mkdirSync(join(root, "run"));
  return root;
}

function run(root, codexBody, extraArgs = []) {
  const codex = join(root, "bin", "codex");
  writeFileSync(codex, codexBody);
  chmodSync(codex, 0o755);
  return spawnSync("node", [script, "--run-root", join(root, "run"), "--base", "HEAD", ...extraArgs], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, PATH: `${join(root, "bin")}:${process.env.PATH}` },
  });
}

function receipt(root) {
  return JSON.parse(readFileSync(join(root, "run/reviews/codex-senior-review.json"), "utf8"));
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

describe("codex senior review command", () => {
  it("writes a packet and passing receipt when codex review completes cleanly", () => {
    const root = makeTemp();
    try {
      const result = run(root, "#!/usr/bin/env bash\necho 'No findings.'\n");

      expect(result.status).toBe(0);
      expect(existsSync(join(root, "run/reviews/codex-senior-review-packet.md"))).toBe(true);
      expect(receipt(root)).toMatchObject({ status: "pass", reviewer: "codex-senior", blocker: null });
    } finally {
      cleanup(root);
    }
  });

  it("classifies quota or rate-limit output as a structured blocker", () => {
    const root = makeTemp();
    try {
      const result = run(root, "#!/usr/bin/env bash\necho '429 rate limit exceeded' >&2\nexit 1\n");

      expect(result.status).not.toBe(0);
      expect(receipt(root)).toMatchObject({ status: "blocked", blocker: "quota_or_rate_limit" });
    } finally {
      cleanup(root);
    }
  });

  it("classifies first-output timeout as no_output_timeout", () => {
    const root = makeTemp();
    try {
      const result = run(root, "#!/usr/bin/env bash\nsleep 5\n", ["--first-output-timeout-ms", "10"]);

      expect(result.status).not.toBe(0);
      expect(receipt(root)).toMatchObject({ status: "blocked", blocker: "no_output_timeout" });
    } finally {
      cleanup(root);
    }
  });

  it("classifies a non-completing review with output as total_timeout", () => {
    const root = makeTemp();
    try {
      const result = run(root, "#!/usr/bin/env bash\necho starting\nsleep 5\n", ["--first-output-timeout-ms", "1000", "--total-timeout-ms", "20"]);

      expect(result.status).not.toBe(0);
      expect(receipt(root)).toMatchObject({ status: "blocked", blocker: "total_timeout" });
    } finally {
      cleanup(root);
    }
  });
});
