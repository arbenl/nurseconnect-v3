import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildReport,
  controlledRunbookRequirements,
  requiredFiles,
  requiredRunbookCommands,
  requiredScripts,
  runbookRequirements,
} from "../launch-readiness-report.mjs";

let roots = [];

function write(root, path, content = "") {
  const fullPath = join(root, path);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content);
}

function createFixture(options = {}) {
  const root = join(
    tmpdir(),
    `nurseconnect-launch-readiness-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  roots.push(root);
  mkdirSync(root, { recursive: true });

  const scripts = Object.fromEntries(
    requiredScripts.map((scriptName) => [scriptName, `echo ${scriptName}`]),
  );
  write(root, "package.json", JSON.stringify({ scripts }, null, 2));

  for (const file of requiredFiles) {
    if (options.omitFile === file) {
      continue;
    }
    write(root, file, "");
  }

  const launchSections = runbookRequirements
    .filter((section) => section !== options.omitLaunchSection)
    .map((section) => `## ${section}\n`)
    .join("\n");
  const launchCommands = requiredRunbookCommands.join("\n");
  write(root, "docs/runbooks/launch_readiness_review.md", `${launchSections}\n${launchCommands}\n`);

  if (options.omitFile !== "docs/runbooks/controlled_launch_execution_readiness.md") {
    const controlledSections = controlledRunbookRequirements
      .filter((section) => section !== options.omitControlledSection)
      .map((section) => `## ${section}\n`)
      .join("\n");
    write(root, "docs/runbooks/controlled_launch_execution_readiness.md", controlledSections);
  }

  return root;
}

describe("launch-readiness-report", () => {
  afterEach(() => {
    for (const root of roots) {
      rmSync(root, { recursive: true, force: true });
    }
    roots = [];
  });

  it("passes for a complete launch readiness fixture", () => {
    const report = buildReport(createFixture());

    expect(report.passed).toBe(true);
    expect(report.failed).toBe(0);
  });

  it("fails when the controlled launch runbook is missing", () => {
    const report = buildReport(
      createFixture({ omitFile: "docs/runbooks/controlled_launch_execution_readiness.md" }),
    );

    expect(report.passed).toBe(false);
    expect(report.failures).toContain(
      "required file: docs/runbooks/controlled_launch_execution_readiness.md",
    );
    expect(report.failures).toContain("controlled launch runbook section: Purpose");
  });

  it("fails when the launch readiness review lacks the controlled decision section", () => {
    const report = buildReport(
      createFixture({ omitLaunchSection: "Controlled Launch Execution Decision" }),
    );

    expect(report.passed).toBe(false);
    expect(report.failures).toContain(
      "launch runbook section: Controlled Launch Execution Decision",
    );
  });

  it("fails when the controlled runbook loses required hard-gate sections", () => {
    const report = buildReport(createFixture({ omitControlledSection: "Hard Launch Gates" }));

    expect(report.passed).toBe(false);
    expect(report.failures).toContain("controlled launch runbook section: Hard Launch Gates");
  });
});
