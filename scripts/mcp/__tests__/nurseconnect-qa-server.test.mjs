/* eslint-env node */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "../../..");

describe("nurseconnect QA MCP server", () => {
  it("uses the NurseConnect repo root even when MCP_REPO_ROOT is inherited", async () => {
    const fakeRoot = await mkdtemp(resolve(tmpdir(), "wrong-mcp-root-"));
    await writeFile(
      resolve(fakeRoot, ".mcp-toolkit.json"),
      JSON.stringify({
        qa: {
          defaultCwd: ".",
          commands: {
            wrong_repo_suite: "echo wrong repo",
          },
        },
      })
    );

    const client = new Client({ name: "nurseconnect-mcp-test", version: "1.0.0" });
    const transport = new StdioClientTransport({
      command: "bash",
      args: ["scripts/start-repo-qa.sh"],
      cwd: repoRoot,
      env: { ...process.env, MCP_REPO_ROOT: fakeRoot },
    });

    try {
      await client.connect(transport);
      const { tools } = await client.listTools();
      const testRunner = tools.find((tool) => tool.name === "test_runner");
      const suites = testRunner?.inputSchema?.properties?.suite?.enum ?? [];

      expect(suites).toContain("unit");
      expect(suites).toContain("smoke");
      expect(suites).not.toContain("wrong_repo_suite");
    } finally {
      await client.close().catch(() => {});
      await rm(fakeRoot, { recursive: true, force: true });
    }
  });

  it("exposes enterprise inspection tools for NurseConnect slices", async () => {
    const client = new Client({ name: "nurseconnect-mcp-tools-test", version: "1.0.0" });
    const transport = new StdioClientTransport({
      command: "bash",
      args: ["scripts/start-repo-qa.sh"],
      cwd: repoRoot,
      env: { ...process.env },
    });

    try {
      await client.connect(transport);
      const { tools } = await client.listTools();
      const toolNames = tools.map((tool) => tool.name);

      expect(toolNames).toContain("project_map");
      expect(toolNames).toContain("code_search");
      expect(toolNames).toContain("branch_status");
      expect(toolNames).toContain("scope_audit");
      expect(toolNames).toContain("modularity_audit");
      expect(toolNames).toContain("slice_evidence_audit");
      expect(toolNames).toContain("repo_verify");
    } finally {
      await client.close().catch(() => {});
    }
  });

  it("returns a bounded project map and code search result through MCP", async () => {
    const client = new Client({ name: "nurseconnect-mcp-search-test", version: "1.0.0" });
    const transport = new StdioClientTransport({
      command: "bash",
      args: ["scripts/start-repo-qa.sh"],
      cwd: repoRoot,
      env: { ...process.env },
    });

    try {
      await client.connect(transport);
      const projectMap = await client.callTool({ name: "project_map", arguments: {} });
      const projectPayload = JSON.parse(projectMap.content[0].text);

      expect(projectPayload.repo).toBe("nurseconnect-v3");
      expect(projectPayload.configuredSuites).toContain("release");
      expect(projectPayload.keyDocs).toContain("AGENTS.md");

      const search = await client.callTool({
        name: "code_search",
        arguments: {
          query: "nurseconnect_qa",
          globs: ["scripts/mcp/**", ".codex/config.toml", ".mcp-toolkit.json"],
          maxResults: 20,
        },
      });
      const searchPayload = JSON.parse(search.content[0].text);

      expect(searchPayload.status).toBe("success");
      expect(searchPayload.results.join("\n")).toContain("nurseconnect_qa");
      expect(searchPayload.results.length).toBeLessThanOrEqual(20);

      const modularity = await client.callTool({ name: "modularity_audit", arguments: { base: "HEAD" } });
      const modularityPayload = JSON.parse(modularity.content[0].text);
      expect(modularityPayload.status).toBe("success");
    } finally {
      await client.close().catch(() => {});
    }
  });
});
