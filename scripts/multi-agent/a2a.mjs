#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import { asString, parseArgv, printHelpAndExit, printJson } from "./lib/cli.mjs";
import { loadMultiAgentConfig, resolveRepoPath } from "./lib/config.mjs";
import {
  exportRequestToA2A,
  exportResultToA2A,
  importRequestFromA2A,
  importResultFromA2A,
} from "./lib/a2a-adapter.mjs";

const HELP = `
Usage:
  node scripts/multi-agent/a2a.mjs <export|import> [options]

Options:
  --type <request|result>                  Payload type (default: request)
  --input <path>                           Input JSON file path
  --output <path>                          Output JSON file path (stdout if omitted)
  --source <id>                            A2A source identity override
  --target <id>                            A2A target identity override
  --config <path>                          Config path (default: config/multi-agent.config.json)
  --help                                   Show this help text
`;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function resolveInputPath(loaded, requestedInput) {
  if (!requestedInput) {
    throw new Error("--input is required");
  }
  return resolveRepoPath(loaded.repoRoot, requestedInput);
}

function resolveOutputPath(loaded, requestedOutput) {
  if (!requestedOutput) {
    return null;
  }
  return resolveRepoPath(loaded.repoRoot, requestedOutput);
}

function main() {
  const parsed = parseArgv(process.argv.slice(2));
  const command = asString(parsed._[0], "").toLowerCase();

  if (parsed.help || !command) {
    printHelpAndExit(HELP, command ? 0 : 1);
  }

  if (!["export", "import"].includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }

  const payloadType = asString(parsed.type, "request").toLowerCase();
  if (!["request", "result"].includes(payloadType)) {
    throw new Error(`Unsupported --type: ${payloadType}`);
  }

  const loaded = loadMultiAgentConfig({ configPath: asString(parsed.config, "") });
  const inputPath = resolveInputPath(loaded, asString(parsed.input, ""));
  const outputPath = resolveOutputPath(loaded, asString(parsed.output, ""));

  const source = asString(parsed.source, loaded.config.a2a?.defaultSource || "nurseconnect.multiagent");
  const target = asString(parsed.target, loaded.config.a2a?.defaultTarget || "a2a.partner");

  const input = readJson(inputPath);

  let output;
  if (command === "export" && payloadType === "request") {
    output = exportRequestToA2A(input, {
      source,
      target,
      protocol: loaded.config.a2a?.protocolVersion,
      requestKind: loaded.config.a2a?.requestKind,
    });
  } else if (command === "export" && payloadType === "result") {
    output = exportResultToA2A(input, {
      source,
      target,
      protocol: loaded.config.a2a?.protocolVersion,
      resultKind: loaded.config.a2a?.resultKind,
    });
  } else if (command === "import" && payloadType === "request") {
    output = importRequestFromA2A(input);
  } else {
    output = importResultFromA2A(input);
  }

  if (outputPath) {
    writeJson(outputPath, output);
    printJson({ outputPath, status: "ok" });
    return;
  }

  printJson(output);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
}
