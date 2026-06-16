#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const data = JSON.parse(process.env.PR_JSON || "{}");
const files = Array.isArray(data.files)
  ? data.files.map((entry) => (typeof entry === "string" ? entry : entry.path)).filter(Boolean)
  : [];
const completeFiles = loadCompleteFiles(data.number, files);
const args = ["scripts/check-pr-slice-evidence.mjs"];
if (process.env.PR_FINALIZER_VERIFY_SLICE_RUN_ROOT === "1") args.push("--verify-run-root");
if (process.env.PR_FINALIZER_ALLOW_MISSING_SLICE_RUN_ROOT === "1") args.push("--allow-missing-run-root");
const baseCommit = data.baseRefOid || process.env.BASE_COMMIT || "";
if (baseCommit) {
  const ref = data.baseRefName ? `refs/heads/${data.baseRefName}` : baseCommit;
  const fetch = spawnSync("git", ["fetch", "--depth=1", "origin", ref], { encoding: "utf8" });
  if (fetch.status !== 0) {
    process.stderr.write(`Failed to fetch PR base ref ${ref}:\n${fetch.stdout || ""}${fetch.stderr || ""}`);
    process.exit(fetch.status ?? 1);
  }
}

const result = spawnSync("node", args, {
  input: "",
  encoding: "utf8",
  env: {
    ...process.env,
    BASE_COMMIT: baseCommit,
    PR_BODY: data.body || "",
    PR_FILES_JSON: JSON.stringify(completeFiles.files),
    PR_FILES_COMPLETE: completeFiles.complete ? "1" : "",
  },
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.status === null) {
  process.stderr.write(`PR slice evidence check terminated by signal: ${result.signal || "unknown"}\n`);
  process.exit(1);
}
process.exit(result.status);

function loadCompleteFiles(number, fallback) {
  if (!number) return { files: fallback, complete: false };
  const result = spawnSync("gh", ["pr", "diff", String(number), "--name-only"], { encoding: "utf8" });
  if (result.status !== 0) return { files: fallback, complete: false };
  return { files: result.stdout.split(/\r?\n/).filter(Boolean), complete: true };
}
