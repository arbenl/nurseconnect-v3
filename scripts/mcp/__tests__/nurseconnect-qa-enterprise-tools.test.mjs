/* eslint-env node */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "../../..");
const requiredReviewers = ["sonnet46", "gemini", "copilot"];

async function writeRunRoot(root) {
  await mkdir(join(root, "evidence"), { recursive: true });
  await mkdir(join(root, "reviews"), { recursive: true });
  await mkdir(join(root, "reviews/subagents"), { recursive: true });
  await writeFile(join(root, "run-manifest.md"), "# Manifest\n");
  await writeFile(join(root, "reviewer-plan.md"), "# Reviewer Plan\n");
  await writeFile(join(root, "reviews/subagents/security_reviewer.md"), "# Security Reviewer\n\nREADY FOR PR\n");
  await writeFile(join(root, "reviews/subagent-handoff.json"), json({
    status: "pass",
    reviewers: [{ reviewer: "security_reviewer", prompt: join(root, "prompts/security_reviewer.md") }],
    missingPrompts: [],
  }));
  await writeFile(join(root, "reviews/subagent-results.json"), json({
    status: "pass",
    selectedReviewers: ["security_reviewer"],
    results: [{ reviewer: "security_reviewer", status: "complete", receiptPath: "reviews/subagents/security_reviewer.md", verdict: "READY FOR PR", mustFixCount: 0 }],
    unresolvedMustFixCount: 0,
  }));
  await writeFile(join(root, "evidence/nurseconnect-qa.json"), json({
    status: "success",
    mcpIdentity: {
      canonical: "nurseconnect_qa",
      requested: "nurseconnect_qa",
      effective: "nurseconnect_qa",
      aliases: ["nurse_qa"],
      owned: ["nurseconnect_qa", "nurse_qa"],
      forbidden: ["interdomestik_qa"],
      configured: ["context7", "nurse_qa", "nurseconnect_qa", "playwright"],
    },
    availableTools: ["branch_status", "modularity_audit", "project_map", "scope_audit", "slice_evidence_audit"],
    branchStatus: { changedFileCount: 1 },
    modularityAudit: { status: "success" },
  }));
  await writeFile(join(root, "reviews/model-review-preflight.json"), json({
    status: "pass",
    reviewers: requiredReviewers,
    results: requiredReviewers.map((reviewer) => ({ reviewer, status: "available" })),
  }));
  await writeFile(join(root, "reviews/model-review-access.json"), json({ status: "pass", reviewers: requiredReviewers, completed: requiredReviewers, blocked: [] }));
  await writeFile(join(root, "evidence/model-review.json"), json({
    status: "complete",
    reviewers: requiredReviewers,
    completed: requiredReviewers,
    dryRun: [],
    blocked: [],
    debate: true,
    agreedMustFixCount: 0,
  }));
}

describe("nurseconnect QA enterprise tools", () => {
  it("runs slice_evidence_audit through the MCP server", async () => {
    const runRoot = await mkdtemp(join(tmpdir(), "nurseconnect-mcp-evidence-"));
    const client = new Client({ name: "nurseconnect-mcp-evidence-test", version: "1.0.0" });
    const transport = new StdioClientTransport({ command: "bash", args: ["scripts/start-repo-qa.sh"], cwd: repoRoot, env: { ...process.env } });

    try {
      await writeRunRoot(runRoot);
      await client.connect(transport);
      const result = await client.callTool({ name: "slice_evidence_audit", arguments: { runRoot } });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.status).toBe("success");
      expect(payload.strict).toBe(false);
      expect(payload.stdout).toContain('"status": "pass"');
    } finally {
      await client.close().catch(() => {});
      await rm(runRoot, { recursive: true, force: true });
    }
  });

  it("runs strict slice_evidence_audit through the MCP server", async () => {
    const runRoot = await mkdtemp(join(tmpdir(), "nurseconnect-mcp-strict-"));
    const client = new Client({ name: "nurseconnect-mcp-strict-test", version: "1.0.0" });
    const transport = new StdioClientTransport({ command: "bash", args: ["scripts/start-repo-qa.sh"], cwd: repoRoot, env: { ...process.env } });

    try {
      await writeRunRoot(runRoot);
      await client.connect(transport);
      const result = await client.callTool({ name: "slice_evidence_audit", arguments: { runRoot, strict: true, mustFixDisposition: "none" } });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.status).toBe("success");
      expect(payload.strict).toBe(true);
      expect(payload.stdout).toContain('"requireSubagentResults": true');
    } finally {
      await client.close().catch(() => {});
      await rm(runRoot, { recursive: true, force: true });
    }
  });
});

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
