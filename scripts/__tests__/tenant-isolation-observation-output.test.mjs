import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("tenant-isolation observation contract", () => {
  it("makes the external zero-signal requirement visible in guard mode", () => {
    const output = execFileSync(
      process.execPath,
      ["scripts/tenant-isolation-abuse.mjs", "--mode", "guard", "--source", "drizzle"],
      { cwd: repoRoot, encoding: "utf8" },
    );

    expect(output).toContain("tenant_scope_violations=external-e2e-required-zero");
  });
});
