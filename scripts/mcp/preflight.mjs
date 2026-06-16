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

function serverBlock(name) {
  const pattern = new RegExp(`\\[mcp_servers\\.${name}\\]([\\s\\S]*?)(?=\\n\\[|$)`);
  return codexConfig.match(pattern)?.[1] || "";
}

function requireNurseQaServer(name) {
  const block = serverBlock(name);
  if (!block) {
    fail(`missing .codex/config.toml mcp_servers.${name}`);
  }
  if (!block.includes('command = "bash"')) {
    fail(`${name} must use portable bash command`);
  }
  if (!block.includes('args = ["scripts/start-repo-qa.sh"]')) {
    fail(`${name} must use repo-relative start script args`);
  }
  if (!block.includes('cwd = "."')) {
    fail(`${name} must use repo-relative cwd`);
  }
}

const codexConfig = read(".codex/config.toml");
const modelRoutes = read("scripts/multi-agent/lib/model-review-routes.mjs");
const toolkit = JSON.parse(read(".mcp-toolkit.json"));
const owned = toolkit.identity?.ownedMcpServers || [];
const forbidden = toolkit.identity?.forbiddenMcpServers || [];
const commands = toolkit.qa?.commands || {};

requireNurseQaServer("nurseconnect_qa");
requireNurseQaServer("nurse_qa");

if (codexConfig.includes("[mcp_servers.interdomestik_qa]")) {
  fail("NurseConnect must not wire interdomestik_qa");
}

if (!owned.includes("nurseconnect_qa")) {
  fail(".mcp-toolkit.json must own nurseconnect_qa");
}

if (!owned.includes("nurse_qa")) {
  fail(".mcp-toolkit.json must own nurse_qa alias");
}

if (!forbidden.includes("interdomestik_qa")) {
  fail(".mcp-toolkit.json must mark interdomestik_qa forbidden");
}

if (!modelRoutes.includes('export const defaultReviewers = ["sonnet46", "gemini"];')) {
  fail("model-review default reviewers must be sonnet46,gemini");
}

if (!modelRoutes.includes('CLAUDE_48_REVIEW_MODEL || "claude-opus-4-8"')) {
  fail("claude48 route must default to callable claude-opus-4-8");
}

if (!modelRoutes.includes('CLAUDE_47_REVIEW_MODEL || "claude-sonnet-4-6"')) {
  fail("claude47 route must default to callable claude-sonnet-4-6");
}

for (const suite of ["build_health", "unit", "api", "smoke", "release"]) {
  if (!commands[suite]) {
    fail(`missing nurseconnect_qa suite: ${suite}`);
  }
}

process.stdout.write("[mcp-preflight] PASS nurseconnect_qa wiring is repo-scoped\n");
