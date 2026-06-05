#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

function splitList(value) {
  return String(value || "")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    process.stderr.write(`[subagent-handoff] FAIL: ${name} is required\n`);
    process.exit(1);
  }
  return value;
}

const runRoot = requiredEnv("RUN_ROOT");
const reviewers = splitList(requiredEnv("SELECTED_REVIEWERS"));
const baseCommit = process.env.BASE_COMMIT || "";
const changedFilesPath = process.env.CHANGED_FILES || path.join(runRoot, "changed-files.txt");
const reviewDir = path.join(runRoot, "reviews");
mkdirSync(reviewDir, { recursive: true });

const prompts = reviewers.map((reviewer) => ({
  reviewer,
  prompt: path.join(runRoot, "prompts", `${reviewer}.md`),
}));
const missingPrompts = prompts.filter((item) => !existsSync(item.prompt)).map((item) => item.reviewer);
const orchestrator = path.join(runRoot, "prompts", "orchestrator.md");
const payload = {
  generatedAt: new Date().toISOString(),
  status: missingPrompts.length === 0 && existsSync(orchestrator) ? "pass" : "fail",
  runRoot,
  baseCommit,
  changedFilesPath,
  reviewers: prompts,
  orchestrator,
  dispatchRules: [
    "Spawn selected reviewers in parallel where tooling allows.",
    "Reviewers are read-only and must use the changed-file inventory.",
    "Collect MUST_FIX, SHOULD_FIX, and NICE_TO_HAVE findings.",
    "Every MUST_FIX must be fixed or technically rejected before PR.",
  ],
  missingPrompts,
};

const jsonPath = path.join(reviewDir, "subagent-handoff.json");
const mdPath = path.join(reviewDir, "subagent-handoff.md");
writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
writeFileSync(
  mdPath,
  [
    "# Subagent Reviewer Handoff",
    "",
    `- status: \`${payload.status}\``,
    `- reviewers: \`${reviewers.join(", ") || "none"}\``,
    `- changed_files: \`${changedFilesPath}\``,
    `- orchestrator: \`${orchestrator}\``,
    `- missing_prompts: \`${missingPrompts.join(", ") || "none"}\``,
    "",
    "## Dispatch Rules",
    ...payload.dispatchRules.map((rule) => `- ${rule}`),
    "",
    "## Reviewer Prompts",
    ...prompts.map((item) => `- \`${item.reviewer}\`: \`${item.prompt}\``),
    "",
    "## Files",
    "",
    `- Raw JSON: \`${jsonPath}\``,
  ].join("\n")
);

process.stdout.write(`[subagent-handoff] ${payload.status}: ${mdPath}\n`);
if (payload.status !== "pass") process.exit(1);
