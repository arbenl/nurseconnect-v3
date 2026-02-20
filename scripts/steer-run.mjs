#!/usr/bin/env node
/**
 * Usage:
 *   node scripts/steer-run.mjs <task-id> [--risk low|medium|high] [--include-optional]
 *   RISK can also be provided via --risk or RISK env var. Default is low.
 *
 * Outputs:
 *   artifacts/<task-id>/manifest.json
 *   artifacts/<task-id>/agentOutputs.<agent>.json
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const STEER_SCHEMA_PATH = path.join(root, "schemas", "steer-output.schema.json");

function writeValidationReport(taskDir, task, phase, validationErrors, meta = {}, schema) {
  const report = {
    task,
    phase,
    status: validationErrors.length === 0 ? "pass" : "fail",
    generatedAt: new Date().toISOString(),
    errors: validationErrors,
    meta,
  };
  if (schema && schema.validation) {
    const validationSchemaErrors = [];
    validateBySchema(report, schema.validation, "validation", validationSchemaErrors);
    if (validationSchemaErrors.length > 0) {
      console.warn(`validation report schema warning: ${validationSchemaErrors.join(", ")}`);
    }
  }
  writeFileSync(
    path.join(taskDir, "validation.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
  return report;
}

function parseArgs(argv) {
  const parsed = {
    task: null,
    risk: process.env.RISK || "low",
    includeOptional: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--") && !parsed.task) {
      parsed.task = arg;
      continue;
    }

    if (arg === "--risk" || arg === "--level") {
      parsed.risk = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith("--risk=") || arg.startsWith("--level=")) {
      parsed.risk = arg.split("=").at(1);
      continue;
    }

    if (arg === "--include-optional") {
      parsed.includeOptional = true;
      continue;
    }

  }

  return parsed;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateBySchema(value, schema, pathHint, errors) {
  const currentPath = pathHint || "root";
  if (!schema || typeof schema !== "object") {
    return;
  }

  if (schema.type === "object") {
    if (!isObject(value)) {
      errors.push(`${currentPath}: expected object`);
      return;
    }
    const required = schema.required || [];
    for (const key of required) {
      if (!(key in value)) {
        errors.push(`${currentPath}: missing required field "${key}"`);
      }
    }
    const properties = schema.properties || {};
    for (const [key, propSchema] of Object.entries(properties)) {
      if (value[key] !== undefined) {
        validateBySchema(value[key], propSchema, `${currentPath}.${key}`, errors);
      }
    }
    return;
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) {
      errors.push(`${currentPath}: expected array`);
      return;
    }
    if (schema.items) {
      for (let i = 0; i < value.length; i += 1) {
        validateBySchema(value[i], schema.items, `${currentPath}[${i}]`, errors);
      }
    }
    return;
  }

  if (schema.type === "string") {
    if (typeof value !== "string") {
      errors.push(`${currentPath}: expected string`);
    } else {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push(`${currentPath}: below minLength ${schema.minLength}`);
      }
      if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${currentPath}: invalid enum value "${value}"`);
      }
      if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) {
        errors.push(`${currentPath}: invalid date-time`);
      }
    }
    return;
  }

  if (schema.type === "number") {
    if (typeof value !== "number" || Number.isNaN(value)) {
      errors.push(`${currentPath}: expected number`);
      return;
    }
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${currentPath}: number below minimum ${schema.minimum}`);
    }
  }
}

function loadSchema() {
  const raw = readFileSync(STEER_SCHEMA_PATH, "utf8");
  return JSON.parse(raw);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalizeForHash(obj) {
  if (Array.isArray(obj)) {
    return obj.map((value) => canonicalizeForHash(value));
  }
  if (obj && typeof obj === "object") {
    return Object.keys(obj)
      .sort()
      .reduce((acc, key) => {
        acc[key] = canonicalizeForHash(obj[key]);
        return acc;
      }, {});
  }
  return obj;
}

function runAgent(agentId, task, taskDir, catalog, schema, validationErrors, risk) {
  const outFile = path.join(root, "output", task, `${agentId.toUpperCase()}.plan.json`);
  const artifactFile = path.join(taskDir, `agentOutputs.${agentId}.json`);
  const runLogFile = path.join(taskDir, `agent.${agentId}.log.txt`);

  const child = spawnSync(
    "node",
    ["scripts/agent-runner.mjs", agentId, task],
    {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe",
      shell: false,
      env: {
        ...process.env,
        RISK: risk,
      },
    }
  );

  const stdout = child.stdout || "";
  const stderr = child.stderr || "";

  const log = [
    `command: node scripts/agent-runner.mjs ${agentId} ${task}`,
    `exitCode: ${child.status}`,
    "----- stdout -----",
    stdout,
    "----- stderr -----",
    stderr,
  ].join("\n");
  writeFileSync(runLogFile, log, "utf8");

  if (child.status !== 0) {
    validationErrors.push({
      kind: "agent-run-failed",
      agentId,
      reason: [`exitCode:${child.status}`],
    });
    throw new Error(`Agent ${agentId} failed with exit code ${child.status}`);
  }

  if (!existsSync(outFile)) {
    validationErrors.push({
      kind: "agent-output-missing",
      agentId,
      reason: [`missing output path: ${path.relative(root, outFile)}`],
    });
    throw new Error(`Expected output not found: ${outFile}`);
  }

  const output = readFileSync(outFile, "utf8");
  const parsedOutput = JSON.parse(output);

  const errors = [];
  validateBySchema(parsedOutput, schema.agentOutput, `agent-output(${agentId})`, errors);
  if (parsedOutput.agent !== agentId && parsedOutput.agent !== agentId.toUpperCase()) {
    errors.push(`agent-output(${agentId}): top-level agent field mismatch (${parsedOutput.agent})`);
  }
  if (errors.length > 0) {
    validationErrors.push({
      kind: "agent-output-invalid",
      agentId,
      reason: errors,
    });
    throw new Error(`Agent output schema validation failed for ${agentId}:\n- ${errors.join("\n- ")}`);
  }
  writeFileSync(artifactFile, output, "utf8");

  return {
    id: agentId,
    name: catalog[agentId]?.name || agentId,
    source: path.relative(root, outFile),
    artifact: path.relative(root, artifactFile),
    log: path.relative(root, runLogFile),
    summary: readAgentSummary(output),
  };
}

function readAgentSummary(output) {
  try {
    const parsed = JSON.parse(output);
    return {
      summary: parsed.summary || "",
      actionCount: Array.isArray(parsed.actions) ? parsed.actions.length : (Array.isArray(parsed.ops) ? parsed.ops.length : 0),
    };
  } catch {
    return {
      summary: "",
      actionCount: 0,
    };
  }
}

function main() {
  const { task, risk, includeOptional } = parseArgs(process.argv.slice(2));

  if (!task) {
    console.error("Usage: node scripts/steer-run.mjs <task-id> [--risk low|medium|high]");
    process.exit(1);
  }

  const configPath = path.join(root, "steer", "steer.config.json");
  if (!existsSync(configPath)) {
    console.error("Missing configuration: steer/steer.config.json");
    process.exit(1);
  }

  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const catalog = config.agentCatalog || {};
  const schema = loadSchema();
  const taskDir = path.join(root, "artifacts", task);
  mkdirSync(taskDir, { recursive: true });
  const validationErrors = [];

  const profile = config.taskProfiles?.[risk];
  if (!profile) {
    validationErrors.push({
      kind: "invalid-risk",
      reason: [`unknown risk level: ${risk}`],
    });
    writeValidationReport(taskDir, task, "run", validationErrors, { phase: "config-validation" }, schema);
    console.error(`Unknown risk level: ${risk}. Use low, medium, or high.`);
    process.exit(1);
  }

  const requiredAgents = [...profile.requiredAgents];
  const optionalAgents = includeOptional ? [...(profile.optionalAgents || [])] : [];
  const runAgents = [...requiredAgents, ...optionalAgents];

  const manifest = {
    task,
    risk,
    startedAt: new Date().toISOString(),
    profile: {
      requiredAgents,
      optionalAgents,
      requiredArtifacts: profile.requiredArtifacts,
      resolvedAsOf: new Date().toISOString(),
    },
    results: {
      agents: [],
    },
    artifacts: [],
  };

  for (const agentId of runAgents) {
    try {
      const result = runAgent(agentId, task, taskDir, catalog, schema, validationErrors, risk);
      manifest.results.agents.push(result);
      manifest.artifacts.push(result.artifact);
      manifest.artifacts.push(result.log);
    } catch (error) {
      writeValidationReport(taskDir, task, "run", validationErrors, { phase: "agent-execution" }, schema);
      throw error;
    }
  }

  const manifestFile = path.join(taskDir, "manifest.json");
  manifest.artifacts.push(path.relative(root, manifestFile));
  manifest.artifacts = Array.from(new Set(manifest.artifacts));

  // Normalize and hash manifest inputs
  manifest.endedAt = new Date().toISOString();
  const manifestPayload = JSON.stringify(canonicalizeForHash(manifest), null, 2);
  const manifestHash = sha256(manifestPayload);
  manifest.hash = manifestHash;

  writeFileSync(manifestFile, `${manifestPayload}\n`, "utf8");

  if (!existsSync(manifestFile)) {
    validationErrors.push({
      kind: "manifest-write-failed",
      reason: [`failed writing ${path.relative(root, manifestFile)}`],
    });
    writeValidationReport(taskDir, task, "run", validationErrors, { phase: "manifest-write" }, schema);
    console.error(`Failed to write manifest file: ${manifestFile}`);
    process.exit(1);
  }

  const signature = {
    task,
    risk,
    manifestHash,
    agents: manifest.results.agents.map((a) => ({ id: a.id, name: a.name })),
  };
  manifest.signature = signature;
  writeFileSync(path.join(taskDir, "signature.json"), JSON.stringify(signature, null, 2) + "\n", "utf8");

  const manifestErrors = [];
  validateBySchema(manifest, schema.manifest, "manifest-final", manifestErrors);
  if (manifestErrors.length > 0) {
    validationErrors.push({
      kind: "manifest-invalid",
      reason: manifestErrors,
    });
    writeValidationReport(taskDir, task, "run", validationErrors, { phase: "manifest-validation" }, schema);
    console.error(`Manifest schema validation failed after finalization:\n- ${manifestErrors.join("\n- ")}`);
    process.exit(1);
  }
  writeFileSync(manifestFile, `${JSON.stringify(canonicalizeForHash(manifest), null, 2)}\n`, "utf8");
  writeValidationReport(taskDir, task, "run", validationErrors, { phase: "success" }, schema);

  console.log(`✅ steer run complete for ${task}`);
}

main();
