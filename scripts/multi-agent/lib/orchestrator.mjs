import fs from "node:fs";
import path from "node:path";

import { loadMultiAgentConfig, resolveConfiguredPath } from "./config.mjs";
import { runShellCommand } from "./command-runner.mjs";
import { decideExecutionMode } from "./policy-engine.mjs";
import { runComplianceAudit } from "./compliance.mjs";
import { calculateMetricsFromEvents } from "./metrics.mjs";
import { appendNdjson, ensureDir, writeJson } from "./io.mjs";

const DEFAULT_LANE_ORDER = [
  "preflight-agent",
  "gatekeeper",
  "testing-agent",
  "compliance-agent",
  "verification-agent",
  "finalizer-agent",
];

const GATE_COMMAND_MAP = {
  "preflight-agent": "preflightAgentCommands",
  gatekeeper: "gatekeeperCommands",
  "testing-agent": "testingAgentCommands",
  "verification-agent": "verificationCommands",
  "finalizer-agent": "finalizerCommands",
};

function createRunId() {
  const iso = new Date().toISOString().replace(/[.:]/g, "-");
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `${iso}-${randomSuffix}`;
}

function asRelative(repoRoot, absolutePath) {
  return path.relative(repoRoot, absolutePath) || ".";
}

function getRoleCost(config, lane, durationMs) {
  const profile = config.roleCostProfile?.[lane] || {};
  const fixedUsd = Number(profile.fixedUsd || 0);
  const usdPerSecond = Number(profile.usdPerSecond || 0);
  const variable = (Math.max(durationMs, 0) / 1000) * usdPerSecond;
  return Number((fixedUsd + variable).toFixed(6));
}

function appendEvent(runContext, event) {
  const normalized = {
    timestamp: new Date().toISOString(),
    runId: runContext.runId,
    ...event,
  };
  runContext.events.push(normalized);
  appendNdjson(runContext.eventsPath, normalized);
}

function writeStepLog(stepLogPath, payload) {
  ensureDir(path.dirname(stepLogPath));
  fs.writeFileSync(stepLogPath, `${payload}\n`, "utf8");
}

function getLaneCommandList(config, lane) {
  const commandKey = GATE_COMMAND_MAP[lane];
  if (!commandKey) {
    return [];
  }
  const commands = config.gates?.[commandKey];
  if (!Array.isArray(commands)) {
    return [];
  }
  return [...commands];
}

async function runCommandListForLane(options) {
  const {
    runContext,
    lane,
    commands,
    phase,
    timeoutMs,
    dryRun,
    attempt,
    startIndex,
  } = options;

  const commandResults = [];
  let nextIndex = startIndex;

  for (const command of commands) {
    nextIndex += 1;
    const stepLogPath = path.join(runContext.stepLogsDirectory, `${lane}-${nextIndex}.log.txt`);

    appendEvent(runContext, {
      type: "lane-command-start",
      lane,
      phase,
      attempt,
      command,
      stepLog: asRelative(runContext.repoRoot, stepLogPath),
    });

    const result = await runShellCommand(command, {
      cwd: runContext.repoRoot,
      timeoutMs,
      dryRun,
    });

    writeStepLog(
      stepLogPath,
      [
        `lane=${lane}`,
        `phase=${phase}`,
        `attempt=${attempt}`,
        `command=${command}`,
        `status=${result.status}`,
        `exitCode=${result.exitCode}`,
        `timedOut=${result.timedOut}`,
        `startedAt=${result.startedAt}`,
        `finishedAt=${result.finishedAt}`,
        "--- stdout ---",
        result.stdout || "",
        "--- stderr ---",
        result.stderr || "",
      ].join("\n")
    );

    const normalizedResult = {
      phase,
      command,
      status: result.status,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      timedOut: result.timedOut,
      attempt,
      stepLog: asRelative(runContext.repoRoot, stepLogPath),
      stdout: (result.stdout || "").slice(0, 4000),
      stderr: (result.stderr || "").slice(0, 2000),
    };

    commandResults.push(normalizedResult);

    appendEvent(runContext, {
      type: "lane-command-complete",
      lane,
      phase,
      attempt,
      status: result.status,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      command,
      stepLog: normalizedResult.stepLog,
    });

    if (result.status !== "pass") {
      break;
    }
  }

  return {
    commandResults,
    nextIndex,
  };
}

async function executeStandardLane(options) {
  const {
    runContext,
    lane,
    commands,
    timeoutMs,
    dryRun,
  } = options;

  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  appendEvent(runContext, { type: "lane-start", lane, startedAt });

  const { commandResults } = await runCommandListForLane({
    runContext,
    lane,
    commands,
    phase: "main",
    timeoutMs,
    dryRun,
    attempt: 1,
    startIndex: 0,
  });

  const status = commandResults.every((result) => result.status === "pass") ? "pass" : "fail";
  const durationMs = Date.now() - startedMs;
  const costUsd = getRoleCost(runContext.config, lane, durationMs);

  const laneResult = {
    lane,
    status,
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs,
    costUsd,
    attempts: 1,
    commands: commandResults,
    notes: [],
  };

  appendEvent(runContext, {
    type: "lane-complete",
    lane,
    status,
    durationMs,
    costUsd,
    attempts: 1,
  });

  return laneResult;
}

async function executeVerificationLane(options) {
  const {
    runContext,
    timeoutMs,
    dryRun,
  } = options;

  const lane = "verification-agent";
  const verifyCommands = getLaneCommandList(runContext.config, lane);
  const remediationCommands = runContext.config.gates?.verificationRemediationCommands || [];
  const maxRetries = Number(runContext.config.retryLimits?.verificationAgent || 0);

  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  appendEvent(runContext, { type: "lane-start", lane, startedAt });

  const commandResults = [];
  const notes = [];
  let stepIndex = 0;
  let attempts = 0;
  let status = "fail";

  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    attempts = attempt;

    const verifyRun = await runCommandListForLane({
      runContext,
      lane,
      commands: verifyCommands,
      phase: "verify",
      timeoutMs,
      dryRun,
      attempt,
      startIndex: stepIndex,
    });

    stepIndex = verifyRun.nextIndex;
    commandResults.push(...verifyRun.commandResults);

    const verifyPassed = verifyRun.commandResults.every((result) => result.status === "pass");
    if (verifyPassed) {
      status = "pass";
      notes.push(`Verification passed on attempt ${attempt}`);
      break;
    }

    if (attempt <= maxRetries && remediationCommands.length > 0) {
      notes.push(`Verification failed on attempt ${attempt}; running remediation commands.`);
      const remediationRun = await runCommandListForLane({
        runContext,
        lane,
        commands: remediationCommands,
        phase: "remediation",
        timeoutMs,
        dryRun,
        attempt,
        startIndex: stepIndex,
      });

      stepIndex = remediationRun.nextIndex;
      commandResults.push(...remediationRun.commandResults);
    }
  }

  if (status !== "pass") {
    notes.push("Verification failed after configured retries. Review step logs and rerun with corrected commands.");
  }

  const durationMs = Date.now() - startedMs;
  const costUsd = getRoleCost(runContext.config, lane, durationMs);

  const laneResult = {
    lane,
    status,
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs,
    costUsd,
    attempts,
    commands: commandResults,
    notes,
  };

  appendEvent(runContext, {
    type: "lane-complete",
    lane,
    status,
    durationMs,
    costUsd,
    attempts,
  });

  return laneResult;
}

function executeComplianceLane(runContext, laneResults) {
  const lane = "compliance-agent";
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();

  appendEvent(runContext, { type: "lane-start", lane, startedAt });

  const report = runComplianceAudit({
    runDir: runContext.runDirectory,
    laneResults,
    complianceConfig: runContext.config.compliance || {},
  });

  const stepLogPath = path.join(runContext.stepLogsDirectory, `${lane}-1.log.txt`);
  writeStepLog(stepLogPath, JSON.stringify(report, null, 2));

  for (const finding of report.findings) {
    appendEvent(runContext, {
      type: "compliance-finding",
      lane,
      category: finding.category,
      message: finding.message || finding.pattern || "finding",
      file: finding.file ? asRelative(runContext.repoRoot, finding.file) : undefined,
    });
  }

  const durationMs = Date.now() - startedMs;
  const costUsd = getRoleCost(runContext.config, lane, durationMs);

  const laneResult = {
    lane,
    status: report.status,
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs,
    costUsd,
    attempts: 1,
    commands: [
      {
        phase: "scan",
        command: "compliance-scan",
        status: report.status,
        exitCode: report.status === "pass" ? 0 : 1,
        durationMs,
        timedOut: false,
        attempt: 1,
        stepLog: asRelative(runContext.repoRoot, stepLogPath),
      },
    ],
    notes: report.remediationNotes,
    findings: report.findings,
  };

  appendEvent(runContext, {
    type: "lane-complete",
    lane,
    status: report.status,
    durationMs,
    costUsd,
    attempts: 1,
  });

  return laneResult;
}

async function executeFinalizerLane(runContext, timeoutMs, dryRun) {
  const lane = "finalizer-agent";
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();

  appendEvent(runContext, { type: "lane-start", lane, startedAt });

  const configuredCommands = getLaneCommandList(runContext.config, lane);
  const commandResults = [];
  let stepIndex = 0;

  if (configuredCommands.length > 0) {
    const commandRun = await runCommandListForLane({
      runContext,
      lane,
      commands: configuredCommands,
      phase: "main",
      timeoutMs,
      dryRun,
      attempt: 1,
      startIndex: 0,
    });
    commandResults.push(...commandRun.commandResults);
    stepIndex = commandRun.nextIndex;
  }

  const stepLogPath = path.join(runContext.stepLogsDirectory, `${lane}-${stepIndex + 1}.log.txt`);
  const payload = {
    message: "Finalizer lane completed artifact consolidation.",
    runDirectory: asRelative(runContext.repoRoot, runContext.runDirectory),
    eventsFile: asRelative(runContext.repoRoot, runContext.eventsPath),
  };

  writeStepLog(stepLogPath, JSON.stringify(payload, null, 2));

  const durationMs = Date.now() - startedMs;
  const costUsd = getRoleCost(runContext.config, lane, durationMs);
  const commandStatus = commandResults.every((entry) => entry.status === "pass") ? "pass" : "fail";

  const laneResult = {
    lane,
    status: commandStatus,
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs,
    costUsd,
    attempts: 1,
    commands: [
      ...commandResults,
      {
        phase: "finalize",
        command: "artifact-finalization",
        status: "pass",
        exitCode: 0,
        durationMs,
        timedOut: false,
        attempt: 1,
        stepLog: asRelative(runContext.repoRoot, stepLogPath),
      },
    ],
    notes: [],
  };

  appendEvent(runContext, {
    type: "lane-complete",
    lane,
    status: commandStatus,
    durationMs,
    costUsd,
    attempts: 1,
  });

  return laneResult;
}

function determineLaneOrder(config) {
  const configured = config.lanes?.ordered;
  if (Array.isArray(configured) && configured.length > 0) {
    return configured;
  }
  return DEFAULT_LANE_ORDER;
}

function buildScorecard(runContext, policyDecision, laneResults, status) {
  const metrics = calculateMetricsFromEvents(runContext.events);

  return {
    runId: runContext.runId,
    taskId: runContext.taskId,
    mode: policyDecision.mode,
    status,
    startedAt: runContext.startedAt,
    completedAt: new Date().toISOString(),
    policy: {
      mode: policyDecision.mode,
      score: policyDecision.score,
      reasonCodes: policyDecision.reasonCodes,
      thresholds: policyDecision.thresholds,
      inputs: policyDecision.inputs,
    },
    lanes: laneResults,
    metrics,
    artifacts: {
      events: asRelative(runContext.repoRoot, runContext.eventsPath),
      roleScorecard: asRelative(runContext.repoRoot, runContext.roleScorecardPath),
      stepLogsDirectory: asRelative(runContext.repoRoot, runContext.stepLogsDirectory),
    },
  };
}

export async function runMultiAgentOrchestration(options = {}) {
  const loaded = loadMultiAgentConfig({
    cwd: options.cwd,
    configPath: options.configPath,
  });

  const runId = options.runId || createRunId();
  const runDirectory = resolveConfiguredPath(
    loaded.repoRoot,
    path.join(loaded.config.paths?.tmpRoot || "tmp/multi-agent", `run-${runId}`),
    path.join("tmp/multi-agent", `run-${runId}`)
  );

  const eventsPath = path.join(runDirectory, loaded.config.paths?.eventsFile || "events.ndjson");
  const roleScorecardPath = path.join(
    runDirectory,
    loaded.config.paths?.roleScorecardFile || "role-scorecard.json"
  );
  const stepLogsDirectory = path.join(runDirectory, loaded.config.paths?.stepLogsDir || "steps");

  ensureDir(runDirectory);
  ensureDir(stepLogsDirectory);

  const runContext = {
    repoRoot: loaded.repoRoot,
    config: loaded.config,
    configPath: loaded.configPath,
    runId,
    runDirectory,
    eventsPath,
    roleScorecardPath,
    stepLogsDirectory,
    events: [],
    taskId: String(options.taskId || "adhoc-task"),
    startedAt: new Date().toISOString(),
  };

  appendEvent(runContext, {
    type: "run-start",
    taskId: runContext.taskId,
    configPath: asRelative(runContext.repoRoot, runContext.configPath),
  });

  const policyDecision = decideExecutionMode(
    {
      mode: options.mode || "auto",
      complexity: options.complexity,
      estimatedCostUsd: options.estimatedCostUsd,
      budgetUsd: options.budgetUsd,
      independentTaskCount: options.independentTaskCount,
      requiresComplianceReview: options.requiresComplianceReview,
    },
    loaded.config.policy || {}
  );

  appendEvent(runContext, {
    type: "policy-decision",
    mode: policyDecision.mode,
    reasonCodes: policyDecision.reasonCodes,
    score: policyDecision.score,
  });

  const timeoutMs = Number(loaded.config.retryLimits?.commandTimeoutMs || 300000);
  const dryRun = Boolean(options.dryRun);
  const laneOrder = determineLaneOrder(loaded.config);
  const laneResults = [];

  let overallStatus = "pass";

  const preflightLane = laneOrder.find((lane) => lane === "preflight-agent");
  if (preflightLane) {
    const result = await executeStandardLane({
      runContext,
      lane: preflightLane,
      commands: getLaneCommandList(loaded.config, preflightLane),
      timeoutMs,
      dryRun,
    });
    laneResults.push(result);
    if (result.status !== "pass") {
      overallStatus = "fail";
    }
  }

  const middleLanes = laneOrder.filter(
    (lane) => !["preflight-agent", "compliance-agent", "verification-agent", "finalizer-agent"].includes(lane)
  );

  if (policyDecision.mode === "multi") {
    const parallelSet = new Set(loaded.config.lanes?.parallelizableInMultiMode || []);
    const parallelLanes = middleLanes.filter((lane) => parallelSet.has(lane));
    const sequentialLanes = middleLanes.filter((lane) => !parallelSet.has(lane));

    if (parallelLanes.length > 0) {
      const parallelResults = await Promise.all(
        parallelLanes.map((lane) =>
          executeStandardLane({
            runContext,
            lane,
            commands: getLaneCommandList(loaded.config, lane),
            timeoutMs,
            dryRun,
          })
        )
      );
      laneResults.push(...parallelResults);
      if (parallelResults.some((result) => result.status !== "pass")) {
        overallStatus = "fail";
      }
    }

    for (const lane of sequentialLanes) {
      const result = await executeStandardLane({
        runContext,
        lane,
        commands: getLaneCommandList(loaded.config, lane),
        timeoutMs,
        dryRun,
      });
      laneResults.push(result);
      if (result.status !== "pass") {
        overallStatus = "fail";
      }
    }
  } else {
    for (const lane of middleLanes) {
      const result = await executeStandardLane({
        runContext,
        lane,
        commands: getLaneCommandList(loaded.config, lane),
        timeoutMs,
        dryRun,
      });
      laneResults.push(result);
      if (result.status !== "pass") {
        overallStatus = "fail";
      }
    }
  }

  if (laneOrder.includes("compliance-agent")) {
    const complianceResult = executeComplianceLane(runContext, laneResults);
    laneResults.push(complianceResult);
    if (complianceResult.status !== "pass") {
      overallStatus = "fail";
    }
  }

  if (laneOrder.includes("verification-agent")) {
    const verificationResult = await executeVerificationLane({
      runContext,
      timeoutMs,
      dryRun,
    });
    laneResults.push(verificationResult);
    if (verificationResult.status !== "pass") {
      overallStatus = "fail";
    }
  }

  if (laneOrder.includes("finalizer-agent")) {
    const finalizerResult = await executeFinalizerLane(runContext, timeoutMs, dryRun);
    laneResults.push(finalizerResult);
    if (finalizerResult.status !== "pass") {
      overallStatus = "fail";
    }
  }

  const scorecard = buildScorecard(runContext, policyDecision, laneResults, overallStatus);

  writeJson(roleScorecardPath, scorecard);

  appendEvent(runContext, {
    type: "run-complete",
    status: overallStatus,
    roleScorecard: asRelative(runContext.repoRoot, roleScorecardPath),
  });

  return {
    runId,
    mode: policyDecision.mode,
    status: overallStatus,
    policyDecision,
    runDirectory,
    eventsPath,
    roleScorecardPath,
    scorecard,
  };
}
