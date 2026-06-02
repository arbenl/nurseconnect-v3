#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

function read(rel) {
  return readFileSync(`${root}/${rel}`, "utf8");
}

function fail(message) {
  process.stderr.write(`[mcp-preflight] FAIL: ${message}\n`);
  process.exit(1);
}

const codexConfig = read(".codex/config.toml");
const toolkit = JSON.parse(read(".mcp-toolkit.json"));
const owned = toolkit.identity?.ownedMcpServers || [];
const forbidden = toolkit.identity?.forbiddenMcpServers || [];
const commands = toolkit.qa?.commands || {};

if (!codexConfig.includes("[mcp_servers.nurseconnect_qa]")) {
  fail("missing .codex/config.toml mcp_servers.nurseconnect_qa");
}

if (codexConfig.includes("[mcp_servers.interdomestik_qa]")) {
  fail("NurseConnect must not wire interdomestik_qa");
}

if (!owned.includes("nurseconnect_qa")) {
  fail(".mcp-toolkit.json must own nurseconnect_qa");
}

if (!forbidden.includes("interdomestik_qa")) {
  fail(".mcp-toolkit.json must mark interdomestik_qa forbidden");
}

for (const suite of ["build_health", "unit", "api", "smoke", "release"]) {
  if (!commands[suite]) {
    fail(`missing nurseconnect_qa suite: ${suite}`);
  }
}

process.stdout.write("[mcp-preflight] PASS nurseconnect_qa wiring is repo-scoped\n");
