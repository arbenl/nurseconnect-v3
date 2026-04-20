/* eslint-env node */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../..");

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
      command: "/bin/bash",
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
});
