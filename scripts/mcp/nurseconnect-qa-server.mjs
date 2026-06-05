#!/usr/bin/env node
/* eslint-env node */
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { createEnterpriseHandlers, enterpriseToolSchemas } from "./lib/nurseconnect-enterprise-tools.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const configuredOutputLimit = Number.parseInt(process.env.MCP_OUTPUT_MAX_BYTES || "65536", 10);
const maxCapturedOutputBytes =
  Number.isFinite(configuredOutputLimit) && configuredOutputLimit > 0 ? configuredOutputLimit : 65536;

function wrapResult(payload) {
  return {
    content: [
      {
        type: "text",
        text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
      },
    ],
  };
}

async function loadConfig() {
  const raw = await readFile(resolve(repoRoot, ".mcp-toolkit.json"), "utf8");
  const parsed = JSON.parse(raw);
  return {
    commands: parsed.qa?.commands && typeof parsed.qa.commands === "object" ? parsed.qa.commands : {},
    defaultCwd: parsed.qa?.defaultCwd || ".",
  };
}

function resolveSafeCwd(config, overrideCwd) {
  const cwd = resolve(repoRoot, overrideCwd || config.defaultCwd || ".");
  const rel = relative(repoRoot, cwd);
  if (rel.startsWith("..") || resolve(rel) === rel) {
    throw new Error(`cwd must stay inside NurseConnect repo: ${overrideCwd}`);
  }
  return cwd;
}

function availableSuites(config) {
  return Object.keys(config.commands).sort();
}

function tailOutput(stdout, stderr, maxLines = 40) {
  return `${stdout || ""}\n${stderr || ""}`
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(-maxLines);
}

function appendCappedOutput(current, chunk) {
  const next = `${current}${chunk.toString()}`;
  if (next.length <= maxCapturedOutputBytes) {
    return next;
  }
  return next.slice(-maxCapturedOutputBytes);
}

async function runCommand(command, cwd) {
  const start = Date.now();
  return await new Promise((resolvePromise) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (payload) => {
      if (settled) {
        return;
      }
      settled = true;
      resolvePromise(payload);
    };

    child.stdout.on("data", (chunk) => {
      stdout = appendCappedOutput(stdout, chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = appendCappedOutput(stderr, chunk);
    });
    child.on("error", (error) => {
      stderr = appendCappedOutput(stderr, `\n${error.message}`);
      finish({
        command,
        exitCode: 1,
        durationMs: Date.now() - start,
        stdout,
        stderr,
      });
    });
    child.on("close", (code) => {
      finish({
        command,
        exitCode: typeof code === "number" ? code : 1,
        durationMs: Date.now() - start,
        stdout,
        stderr,
      });
    });
  });
}

async function runConfiguredCommand(config, name, args = {}) {
  const command = config.commands[name];
  if (!command) {
    return {
      status: "error",
      error: `Unknown suite '${name}'. Available suites: ${availableSuites(config).join(", ") || "none configured"}`,
    };
  }

  const result = await runCommand(command, resolveSafeCwd(config, args.cwd));
  const success = result.exitCode === 0;
  return {
    status: success ? "success" : "error",
    suite: name,
    command,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    outputTail: success ? undefined : tailOutput(result.stdout, result.stderr),
  };
}

const config = await loadConfig();
const enterpriseHandlers = createEnterpriseHandlers({ repoRoot, config, availableSuites, runConfiguredCommand });
const server = new Server(
  { name: "nurseconnect-qa", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const cwdSchema = { type: "string", description: "Optional working directory relative to repo root" };
const tools = [
  { name: "build_health", description: "Run NurseConnect typecheck, lint, and web build", inputSchema: { type: "object", properties: { cwd: cwdSchema } } },
  { name: "test_runner", description: "Run a configured NurseConnect test suite", inputSchema: { type: "object", properties: { suite: { type: "string", enum: availableSuites(config) }, cwd: cwdSchema }, required: ["suite"] } },
  { name: "navigation_audit", description: "Run the configured NurseConnect navigation audit/smoke suite", inputSchema: { type: "object", properties: { cwd: cwdSchema } } },
  ...enterpriseToolSchemas(config, availableSuites),
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  if (name === "build_health") {
    return wrapResult(await runConfiguredCommand(config, "build_health", args));
  }
  if (name === "test_runner") {
    return wrapResult(await runConfiguredCommand(config, args.suite, args));
  }
  if (name === "navigation_audit") {
    return wrapResult(await runConfiguredCommand(config, "navigation_audit", args));
  }
  if (enterpriseHandlers[name]) {
    return wrapResult(await enterpriseHandlers[name](args));
  }
  throw new Error(`Unknown tool ${name}`);
});

await server.connect(new StdioServerTransport());
