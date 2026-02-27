import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { ensureDir, writeJson } from "./io.mjs";

function runGit(args, repoRoot) {
  return spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function runShell(command, repoRoot) {
  return spawnSync(command, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function checkCleanTree(repoRoot) {
  const probe = runGit(["status", "--porcelain"], repoRoot);
  if (probe.status !== 0) {
    return {
      status: "fail",
      message: probe.stderr.trim() || "Unable to inspect git status",
    };
  }

  const dirty = String(probe.stdout || "").trim();
  if (dirty) {
    return {
      status: "fail",
      message: "Working tree is not clean",
      details: dirty,
    };
  }

  return {
    status: "pass",
    message: "Working tree is clean",
  };
}

function checkBranchPushed(repoRoot) {
  const branch = runGit(["rev-parse", "--abbrev-ref", "HEAD"], repoRoot);
  if (branch.status !== 0) {
    return {
      status: "fail",
      message: branch.stderr.trim() || "Unable to determine current branch",
    };
  }

  const branchName = String(branch.stdout || "").trim();
  if (!branchName || branchName === "HEAD") {
    return {
      status: "fail",
      message: "Detached HEAD detected; push checks require a branch",
    };
  }

  const upstream = runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], repoRoot);
  if (upstream.status !== 0) {
    return {
      status: "fail",
      message: `No upstream branch configured for ${branchName}`,
    };
  }

  const counts = runGit(["rev-list", "--left-right", "--count", "@{u}...HEAD"], repoRoot);
  if (counts.status !== 0) {
    return {
      status: "fail",
      message: counts.stderr.trim() || "Unable to compare with upstream",
    };
  }

  const [behindRaw, aheadRaw] = String(counts.stdout || "").trim().split(/\s+/);
  const behind = Number(behindRaw || 0);
  const ahead = Number(aheadRaw || 0);

  if (ahead > 0) {
    return {
      status: "fail",
      message: `Branch has ${ahead} unpushed commit(s)`,
    };
  }

  return {
    status: "pass",
    message: "Branch is pushed to upstream",
    details: {
      upstream: String(upstream.stdout || "").trim(),
      behind,
      ahead,
    },
  };
}

function runLocalChecks(commands = [], repoRoot) {
  const steps = [];

  for (const command of commands) {
    const result = runShell(command, repoRoot);
    steps.push({
      command,
      status: result.status === 0 ? "pass" : "fail",
      exitCode: result.status ?? -1,
      stdout: String(result.stdout || "").slice(0, 8000),
      stderr: String(result.stderr || "").slice(0, 4000),
    });

    if (result.status !== 0) {
      break;
    }
  }

  const status = steps.every((step) => step.status === "pass") ? "pass" : "fail";
  return { status, steps };
}

function captureCiSnapshot(command, repoRoot, snapshotPath) {
  if (!command) {
    return {
      status: "skip",
      message: "No CI snapshot command configured",
    };
  }

  const result = runShell(command, repoRoot);
  ensureDir(path.dirname(snapshotPath));
  fs.writeFileSync(
    snapshotPath,
    [
      `# command`,
      command,
      `# exitCode`,
      String(result.status ?? -1),
      `# stdout`,
      String(result.stdout || ""),
      `# stderr`,
      String(result.stderr || ""),
    ].join("\n"),
    "utf8"
  );

  return {
    status: result.status === 0 ? "pass" : "fail",
    command,
    exitCode: result.status ?? -1,
    snapshotPath,
  };
}

export function runFinalizerChecks(options) {
  const {
    repoRoot,
    finalizerConfig = {},
    runLocalChecks: shouldRunLocalChecks = false,
    allowDirty = false,
    outputDirectory,
  } = options;

  const startedAt = new Date().toISOString();
  const report = {
    startedAt,
    status: "pass",
    checks: {},
  };

  if (finalizerConfig.requireCleanTree !== false && !allowDirty) {
    report.checks.cleanTree = checkCleanTree(repoRoot);
  } else {
    report.checks.cleanTree = {
      status: "skip",
      message: allowDirty ? "Skipped due to --allow-dirty" : "Disabled by config",
    };
  }

  if (finalizerConfig.requireBranchPushed !== false) {
    report.checks.branchPush = checkBranchPushed(repoRoot);
  } else {
    report.checks.branchPush = {
      status: "skip",
      message: "Branch push check disabled by config",
    };
  }

  if (shouldRunLocalChecks) {
    report.checks.localChecks = runLocalChecks(finalizerConfig.localCheckCommands || [], repoRoot);
  } else {
    report.checks.localChecks = {
      status: "skip",
      message: "Local checks not requested",
      steps: [],
    };
  }

  const snapshotPath = outputDirectory
    ? path.join(outputDirectory, `ci-snapshot-${Date.now().toString(36)}.txt`)
    : null;

  report.checks.ciSnapshot = captureCiSnapshot(
    finalizerConfig.ciSnapshotCommand,
    repoRoot,
    snapshotPath || path.join(repoRoot, "tmp", "multi-agent", "finalizer", "ci-snapshot-latest.txt")
  );

  const failedChecks = Object.values(report.checks).filter((check) => check.status === "fail");
  if (failedChecks.length > 0) {
    report.status = "fail";
  }

  report.completedAt = new Date().toISOString();
  return report;
}

export function persistFinalizerReport(report, outputPath) {
  writeJson(outputPath, report);
}
