#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const runRoot = process.env.RUN_ROOT;
const base = process.env.BASE_REF || "origin/main";
if (!runRoot) {
  process.stderr.write("[nurseconnect-qa-evidence] RUN_ROOT is required\n");
  process.exit(64);
}
const rawFile = join(runRoot, "evidence", "nurseconnect-qa.json");
const summaryFile = join(runRoot, "evidence", "nurseconnect-qa.md");

function listFromEnv(name) {
  return (process.env[name] || "").split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
}

function parseToolResult(result) {
  const text = result?.content?.[0]?.text;
  if (typeof text !== "string") return { status: "error", error: "MCP tool returned no text content" };
  try {
    return JSON.parse(text);
  } catch (error) {
    return { status: "error", error: `MCP tool returned invalid JSON: ${error.message}`, text };
  }
}

function oneLine(value) {
  if (Array.isArray(value)) return value.length === 0 ? "none" : value.join(", ");
  return value || "none";
}

const payload = {
  status: "blocked",
  generatedUtc: new Date().toISOString(),
  base,
  allowedPaths: listFromEnv("QA_ALLOWED_PATHS"),
  forbiddenPaths: listFromEnv("QA_FORBIDDEN_PATHS"),
  availableTools: [],
  projectMap: null,
  branchStatus: null,
  scopeAudit: null,
  modularityAudit: null,
  blocker: null,
};

const client = new Client({ name: "verify-slice-nurseconnect-qa", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: "bash",
  args: ["scripts/start-repo-qa.sh"],
  cwd: process.cwd(),
  env: { ...process.env },
});

async function collect() {
  await client.connect(transport);
  const { tools } = await client.listTools();
  payload.availableTools = tools.map((tool) => tool.name).sort();
  const requiredTools = ["project_map", "branch_status", "scope_audit", "modularity_audit", "slice_evidence_audit"];
  for (const requiredTool of requiredTools) {
    if (!payload.availableTools.includes(requiredTool)) throw new Error(`nurseconnect_qa missing required tool: ${requiredTool}`);
  }
  payload.projectMap = parseToolResult(await client.callTool({ name: "project_map", arguments: {} }));
  payload.branchStatus = parseToolResult(await client.callTool({ name: "branch_status", arguments: { base } }));
  payload.scopeAudit = parseToolResult(
    await client.callTool({
      name: "scope_audit",
      arguments: { base, allowedPaths: payload.allowedPaths, forbiddenPaths: payload.forbiddenPaths },
    })
  );
  payload.modularityAudit = parseToolResult(await client.callTool({ name: "modularity_audit", arguments: { base } }));
  payload.status = payload.scopeAudit?.status === "success" && payload.modularityAudit?.status === "success" ? "success" : "error";
}

function summary() {
  return [
    "# NurseConnect QA Evidence",
    "",
    `- status: \`${payload.status}\``,
    `- base: \`${payload.base}\``,
    `- available_tools: \`${oneLine(payload.availableTools)}\``,
    `- changed_file_count: \`${payload.branchStatus?.changedFileCount ?? payload.scopeAudit?.changedFileCount ?? "unknown"}\``,
    `- allowed_paths: \`${oneLine(payload.allowedPaths)}\``,
    `- forbidden_paths: \`${oneLine(payload.forbiddenPaths)}\``,
    `- outside_allowed_count: \`${payload.scopeAudit?.outsideAllowed?.length ?? 0}\``,
    `- forbidden_count: \`${payload.scopeAudit?.forbidden?.length ?? 0}\``,
    `- modularity_audit_status: \`${payload.modularityAudit?.status ?? "unknown"}\``,
    payload.blocker ? `- blocker: \`${payload.blocker}\`` : null,
    "",
    "## Files",
    "",
    `- Raw JSON: \`${rawFile}\``,
  ].filter(Boolean).join("\n");
}

let exitCode = 0;
try {
  await collect();
  exitCode = payload.status === "success" ? 0 : 1;
} catch (error) {
  payload.status = "blocked";
  payload.blocker = error instanceof Error ? error.message : String(error);
  exitCode = 2;
} finally {
  await client.close().catch(() => {});
}

await writeFile(rawFile, `${JSON.stringify(payload, null, 2)}\n`);
await writeFile(summaryFile, `${summary()}\n`);
process.exit(exitCode);
