#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const data = JSON.parse(process.env.PR_JSON || "{}");
const files = Array.isArray(data.files)
  ? data.files.map((entry) => (typeof entry === "string" ? entry : entry.path)).filter(Boolean)
  : [];
const args = ["scripts/check-pr-slice-evidence.mjs"];
if (process.env.PR_FINALIZER_VERIFY_SLICE_RUN_ROOT === "1") args.push("--verify-run-root");
if (process.env.PR_FINALIZER_ALLOW_MISSING_SLICE_RUN_ROOT === "1") args.push("--allow-missing-run-root");

const result = spawnSync("node", args, {
  input: "",
  encoding: "utf8",
  env: {
    ...process.env,
    PR_BODY: data.body || "",
    PR_FILES_JSON: JSON.stringify(files),
  },
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status || 0);
