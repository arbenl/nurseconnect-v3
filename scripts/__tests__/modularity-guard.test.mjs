import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { evaluateModularityGuard, parseNameStatus } from "../lib/modularity-guard.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

function git(root, args) {
  return execFileSync("/usr/bin/git", args, { cwd: root, encoding: "utf8" }).trim();
}

function write(root, file, text) {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
}

function initRepo(prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  git(root, ["init", "-q"]);
  git(root, ["config", "user.email", "tests@example.com"]);
  git(root, ["config", "user.name", "Tests"]);
  return root;
}

function commitAll(root) {
  git(root, ["add", "."]);
  git(root, ["commit", "-qm", "seed"]);
  return git(root, ["rev-parse", "HEAD"]);
}

function lines(count, label = "line") {
  return `${Array.from({ length: count }, (_, index) => `${label}-${index + 1}`).join("\n")}\n`;
}

function resultFor(root, base) {
  return evaluateModularityGuard({ root, baseRef: base });
}

describe("modularity guard", () => {
  it("fails when a new checked file exceeds 150 lines", () => {
    const root = initRepo("nurseconnect-modularity-new-");
    write(root, "README.md", "seed\n");
    const base = commitAll(root);
    write(root, "scripts/oversized-new.mjs", lines(151));

    const result = resultFor(root, base);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      file: "scripts/oversized-new.mjs",
      reason: "new-file-over-limit",
    });
  });

  it("fails when a new Markdown file exceeds 150 lines", () => {
    const root = initRepo("nurseconnect-modularity-md-");
    write(root, "README.md", "seed\n");
    const base = commitAll(root);
    write(root, "docs/oversized-new.md", lines(151));

    const result = resultFor(root, base);

    expect(result.violations[0]).toMatchObject({
      file: "docs/oversized-new.md",
      reason: "new-file-over-limit",
    });
  });

  it("fails when a legacy oversized file grows", () => {
    const root = initRepo("nurseconnect-modularity-growth-");
    write(root, "apps/web/src/legacy.ts", lines(151));
    const base = commitAll(root);
    write(root, "apps/web/src/legacy.ts", lines(152));

    const result = resultFor(root, base);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      baseLines: 151,
      currentLines: 152,
      reason: "legacy-file-grew",
    });
  });

  it("allows a legacy oversized file edited without line-count growth", () => {
    const root = initRepo("nurseconnect-modularity-stable-");
    write(root, "apps/web/src/legacy.ts", lines(151, "before"));
    const base = commitAll(root);
    write(root, "apps/web/src/legacy.ts", lines(151, "after"));

    const result = resultFor(root, base);

    expect(result.violations).toEqual([]);
    expect(result.checkedFiles).toBe(1);
  });

  it("keeps generated and lockfile exceptions out of enforcement", () => {
    const root = initRepo("nurseconnect-modularity-exceptions-");
    write(root, "README.md", "seed\n");
    const base = commitAll(root);
    write(root, "pnpm-lock.yaml", lines(400));
    write(root, "packages/database/drizzle/generated.ts", lines(400));

    const result = resultFor(root, base);

    expect(result.violations).toEqual([]);
    expect(result.checkedFiles).toBe(0);
  });

  it("parses renamed entries and checks the surviving path", () => {
    const root = initRepo("nurseconnect-modularity-rename-");
    write(root, "apps/web/src/old-name.ts", lines(151));
    const base = commitAll(root);
    git(root, ["mv", "apps/web/src/old-name.ts", "apps/web/src/new-name.ts"]);
    writeFileSync(join(root, "apps/web/src/new-name.ts"), `${lines(151)}extra\n`);

    const result = resultFor(root, base);

    expect(result.violations[0]).toMatchObject({
      file: "apps/web/src/new-name.ts",
      oldPath: "apps/web/src/old-name.ts",
    });
  });

  it("parses git name-status records", () => {
    expect(parseNameStatus("R100\0old path.ts\0new path.ts\0A\0added.ts\0")).toEqual([
      { file: "new path.ts", oldPath: "old path.ts", status: "R" },
      { file: "added.ts", oldPath: null, status: "A" },
    ]);
  });

  it("uses the current repository root in import paths", () => {
    expect(repoRoot).toContain("nurseconnect-v3");
  });
});
