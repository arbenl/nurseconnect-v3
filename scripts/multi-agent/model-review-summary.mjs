#!/usr/bin/env node
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const runRoot = process.env.RUN_ROOT;
const reviewDir = join(runRoot, "reviews");
const evidenceDir = join(runRoot, "evidence");
const rawFile = join(evidenceDir, "model-review.json");
const summaryFile = join(evidenceDir, "model-review.md");

function list(value) {
  return Array.isArray(value) && value.length > 0 ? value.join(", ") : "none";
}

const payload = {
  status: "not-run",
  reviewers: [],
  completed: [],
  blocked: [],
  dryRun: [],
  debate: false,
  agreedMustFixCount: 0,
  debateVerdict: null,
  manifestPath: join(reviewDir, "model-review-manifest.json"),
  debatePath: join(reviewDir, "debate.md"),
};

async function loadManifest() {
  if (!existsSync(payload.manifestPath)) return;
  const manifest = JSON.parse(await readFile(payload.manifestPath, "utf8"));
  const results = Array.isArray(manifest.results) ? manifest.results : [];
  payload.reviewers = Array.isArray(manifest.reviewers) ? manifest.reviewers : results.map((result) => result.reviewer).filter(Boolean);
  payload.debate = Boolean(manifest.debate);
  payload.completed = results.filter((result) => result.status === "complete").map((result) => result.reviewer);
  payload.dryRun = results.filter((result) => result.status === "dry-run").map((result) => result.reviewer);
  payload.blocked = results.filter((result) => result.status === "blocked").map((result) => result.reviewer);
  if (payload.blocked.length > 0) payload.status = "blocked";
  else if (payload.completed.length > 0 || payload.dryRun.length > 0) payload.status = payload.dryRun.length > 0 ? "dry-run" : "complete";
  else payload.status = "error";
}

async function loadDebate() {
  const debateJsonPath = join(reviewDir, "debate.json");
  if (!existsSync(debateJsonPath)) return;
  const debate = JSON.parse(await readFile(debateJsonPath, "utf8"));
  payload.agreedMustFixCount = Array.isArray(debate.agreedMustFixCandidates) ? debate.agreedMustFixCandidates.length : 0;
  payload.debateVerdict = debate.verdict || null;
}

function summary() {
  return [
    "# Model Review Evidence",
    "",
    `- status: \`${payload.status}\``,
    `- reviewers: \`${list(payload.reviewers)}\``,
    `- completed: \`${list(payload.completed)}\``,
    `- dry_run: \`${list(payload.dryRun)}\``,
    `- blocked: \`${list(payload.blocked)}\``,
    `- debate: \`${payload.debate ? "yes" : "no"}\``,
    `- agreed_must_fix_count: \`${payload.agreedMustFixCount}\``,
    payload.debateVerdict ? `- debate_verdict: \`${payload.debateVerdict}\`` : null,
    "",
    "## Files",
    "",
    `- Manifest: \`${payload.manifestPath}\``,
    `- Debate: \`${payload.debatePath}\``,
    `- Raw JSON: \`${rawFile}\``,
  ].filter(Boolean).join("\n");
}

await loadManifest();
await loadDebate();
await mkdir(evidenceDir, { recursive: true });
await writeFile(rawFile, `${JSON.stringify(payload, null, 2)}\n`);
await writeFile(summaryFile, `${summary()}\n`);
process.stdout.write(`${payload.status}\n${list(payload.completed)}\n${list(payload.dryRun)}\n${list(payload.blocked)}\n`);
