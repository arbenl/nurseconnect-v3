#!/usr/bin/env node
/**
 * Usage:
 *   node scripts/steer-verify.mjs <task-id> [--risk low|medium|high]
 */

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const STEER_SCHEMA_PATH = path.join(root, "schemas", "steer-output.schema.json");
const STEER_CONFIG_PATH = path.join(root, "steer", "steer.config.json");
const TASK_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function parseArgs(argv) {
  const parsed = {
    task: null,
    risk: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--") && !parsed.task) {
      parsed.task = arg;
      continue;
    }

    if (arg === "--risk") {
      parsed.risk = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith("--risk=")) {
      parsed.risk = arg.split("=").at(1);
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
      return;
    }
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${currentPath}: below minLength ${schema.minLength}`);
    }
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`${currentPath}: invalid enum value "${value}"`);
    }
    if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) {
      errors.push(`${currentPath}: invalid date-time`);
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

function loadConfig() {
  const raw = readFileSync(STEER_CONFIG_PATH, "utf8");
  return JSON.parse(raw);
}

function readJson(filePath) {
  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(raw);
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

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function manifestHashWithoutSignature(manifest) {
  const payload = { ...manifest };
  delete payload.signature;
  delete payload.hash;
  return sha256(JSON.stringify(canonicalizeForHash(payload), null, 2));
}

function fail(report, message) {
  report.status = "fail";
  report.errors.push(message);
}

function sanitizeTask(task) {
  const normalizedTask = String(task || "");
  if (!TASK_ID_PATTERN.test(normalizedTask)) {
    throw new Error(
      `Invalid task id "${task}". Use a safe slug (letters, numbers, hyphen, underscore, dot) with no path separators.`
    );
  }
  return normalizedTask;
}

function main() {
  const { task, risk: cliRisk } = parseArgs(process.argv.slice(2));

  if (!task) {
    console.error("Usage: node scripts/steer-verify.mjs <task-id> [--risk low|medium|high]");
    process.exit(1);
  }
  let safeTask;
  try {
    safeTask = sanitizeTask(task);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const configPath = STEER_CONFIG_PATH;
  if (!existsSync(configPath)) {
    console.error("Missing configuration: steer/steer.config.json");
    process.exit(1);
  }
  const config = loadConfig();
  const schema = loadSchema();

  const taskDir = path.join(root, "artifacts", safeTask);
  const manifestPath = path.join(taskDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    console.error(`Missing manifest at ${manifestPath}`);
    process.exit(1);
  }

  const manifest = readJson(manifestPath);
  const manifestErrors = [];
  validateBySchema(manifest, schema.manifest, "manifest", manifestErrors);
  if (manifestErrors.length > 0) {
    console.error(`Manifest schema validation failed:\n- ${manifestErrors.join("\n- ")}`);
    process.exit(1);
  }

  const risk = cliRisk || manifest.risk || "low";
  const profile = config.taskProfiles?.[risk];
  if (!profile) {
    console.error(`Unknown risk level: ${risk}`);
    process.exit(1);
  }

  const catalog = config.agentCatalog || {};
  const report = {
    task: safeTask,
    risk,
    status: "pass",
    runValidation: null,
    agentValidation: [],
    gateValidation: null,
    errors: [],
  };

  const requiredArtifacts = (profile.requiredArtifacts || []).map((name) => path.join(taskDir, name));
  const requiredAgents = profile.requiredAgents || [];
  const validationReportPath = path.join(taskDir, "validation.json");
  if (existsSync(validationReportPath)) {
    try {
      const validation = readJson(validationReportPath);
      const validationErrors = [];
      validateBySchema(validation, schema.validation, "validation", validationErrors);
      if (validationErrors.length > 0) {
        fail(report, `Invalid validation schema: ${validationReportPath} (${validationErrors.join(", ")})`);
      }
      report.runValidation = validation;
      if (validation?.status === "fail") {
        fail(report, `Run validation reported failure: ${path.relative(root, validationReportPath)} (${validation.phase || "run"})`);
      }
    } catch {
      fail(report, `Invalid validation report format: ${path.relative(root, validationReportPath)}`);
    }
  } else {
    fail(report, `Missing run validation report: ${path.relative(root, validationReportPath)}`);
  }

  for (const artifactPath of requiredArtifacts) {
    if (!existsSync(artifactPath)) {
      fail(report, `Missing required artifact: ${path.relative(root, artifactPath)}`);
      continue;
    }

    try {
      readJson(artifactPath);
      if (path.basename(artifactPath).startsWith("agentOutputs.")) {
        const artifact = readJson(artifactPath);
        const agentId = path.basename(artifactPath).replace("agentOutputs.", "").replace(".json", "");
        const artifactErrors = [];
        validateBySchema(artifact, schema.agentOutput, `agent-output(${agentId})`, artifactErrors);
        if (artifactErrors.length > 0) {
          fail(report, `Agent output schema invalid: ${path.relative(root, artifactPath)}\n- ${artifactErrors.join("\n- ")}`);
        }
      }
    } catch {
      fail(report, `Invalid JSON artifact: ${path.relative(root, artifactPath)}`);
    }
  }

  const runAgents = Array.isArray(manifest.results?.agents) ? manifest.results.agents : [];
  const runAgentIds = runAgents.map((agent) => agent.id);
  for (const id of requiredAgents) {
    if (!runAgentIds.includes(id)) {
      fail(report, `Required agent output missing from manifest: ${id}`);
      continue;
    }

    const agentName = catalog[id]?.name || id;
    const outputPath = path.join(taskDir, `agentOutputs.${id}.json`);
    if (!existsSync(outputPath)) {
      fail(report, `Missing required agent output file for ${id} (${agentName})`);
      continue;
    }

    let parsedOutput;
    try {
      parsedOutput = readJson(outputPath);
    } catch {
      fail(report, `Invalid JSON from agent output: ${id} (${agentName})`);
      continue;
    }

    if (parsedOutput.agent !== id.toUpperCase() && parsedOutput.agent !== id) {
      fail(report, `Agent ID mismatch in ${id} output: ${parsedOutput.agent}`);
    }

    const actions = Array.isArray(parsedOutput.actions) ? parsedOutput.actions : [];
    report.agentValidation.push({
      id,
      name: agentName,
      output: path.relative(root, outputPath),
      actionCount: actions.length,
      summary: typeof parsedOutput.summary === "string" ? parsedOutput.summary : "",
    });
  }

  const signaturePath = path.join(taskDir, "signature.json");
  if (existsSync(signaturePath)) {
    try {
      const signature = readJson(signaturePath);
      if (signature.task !== manifest.task) {
        fail(report, "Signature task mismatch with manifest");
      }
      if (signature.risk !== manifest.risk) {
        fail(report, "Signature risk mismatch with manifest");
      }
      if (signature.manifestHash !== manifest.hash) {
        fail(report, "Signature manifest hash mismatch");
      }
      if (typeof manifest.hash === "string" && manifestHashWithoutSignature(manifest) !== manifest.hash) {
        fail(report, "Manifest integrity check failed (stored hash mismatch)");
      }
    } catch {
      fail(report, "Signature artifact is not valid JSON");
    }
  } else {
    fail(report, "Missing required signature artifact: signature.json");
  }

  const gateConfig = config.governance?.verificationGate || {};
  const gateArtifact = gateConfig.artifact || "verification-gates.json";
  const gateRequiredArtifacts = new Set(profile.requiredArtifacts || []);
  const gateRequired =
    gateConfig.requiredByRisk?.[risk] === true ||
    gateRequiredArtifacts.has(gateArtifact);
  const gateReportPath = path.join(taskDir, gateArtifact);
  if (existsSync(gateReportPath)) {
    try {
      const gateReport = readJson(gateReportPath);
      report.gateValidation = gateReport;
      if (gateReport.status !== "pass") {
        fail(report, `Verification gate status is not pass: ${gateArtifact}`);
      }
    } catch {
      fail(report, `Invalid gate report format: ${path.relative(root, gateReportPath)}`);
    }
  } else if (gateRequired) {
    fail(report, `Required verification gate report missing: ${gateArtifact}`);
  }

  const reportPath = path.join(taskDir, "verification.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");

  if (report.status === "fail") {
    console.error("Steer verification failed:");
    for (const err of report.errors) {
      console.error(`- ${err}`);
    }
    process.exit(1);
  }

  console.log(`✅ steer verification passed for ${safeTask}`);
}

main();
