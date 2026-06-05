#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { asString, parseArgv } from "./lib/cli.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));

function evidenceRoot(value) {
  const chosen = value || "tmp/multi-agent/sentry-advisory";
  return path.isAbsolute(chosen) ? chosen : path.join(root, chosen);
}

function writeSummary(dir, status, lines) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "sentry-summary.md"), ["# Sentry Advisory Summary", "", `- status: \`${status}\``, ...lines].join("\n"));
}

function fetchJson(url, token) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { headers: { Authorization: `Bearer ${token}` } }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if ((res.statusCode || 0) < 200 || (res.statusCode || 0) >= 300) {
          reject(new Error(`Sentry HTTP ${res.statusCode || "unknown"}`));
          return;
        }
        resolve(JSON.parse(body || "[]"));
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  const args = parseArgv(process.argv.slice(2));
  const runRoot = evidenceRoot(asString(args["run-root"], ""));
  const strict = args.strict === true || args.strict === "true";
  if (process.env.CI === "1" && process.env.SENTRY_ADVISORY_MODE === "advisory") {
    process.stderr.write("[sentry-advisory] FAIL: advisory mode is forbidden in CI\n");
    process.exit(1);
  }
  const outDir = path.join(runRoot, "evidence", "sentry");
  const token = process.env.SENTRY_AUTH_TOKEN || "";
  const org = process.env.SENTRY_ORG || "";
  const project = process.env.SENTRY_PROJECT || "";
  const base = (process.env.SENTRY_BASE_URL || "https://sentry.io").replace(/\/+$/, "");
  const target = `${org}/${project}`.toLowerCase();

  if (!token || !org || !project) {
    writeSummary(outDir, "MISSING_CONFIG", [
      `- missing: \`${["SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT"].filter((key) => !process.env[key]).join(" ")}\``,
      "- note: configure Sentry variables to turn this into live unresolved-issue evidence.",
    ]);
    process.stdout.write("SENTRY_ADVISORY_STATUS: MISSING_CONFIG\n");
    if (strict) process.exit(1);
    return;
  }

  if (/interdomestik|interdmestik/.test(target)) {
    writeSummary(outDir, "FORBIDDEN_CONFIG", [
      `- configured_project: \`${org}/${project}\``,
      "- reason: NurseConnect must not reuse Interdomestik Sentry configuration.",
    ]);
    process.stderr.write("[sentry-advisory] FAIL: forbidden Interdomestik Sentry configuration\n");
    process.exit(1);
  }

  const url = `${base}/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/issues/?query=is%3Aunresolved&limit=5`;
  const issues = await fetchJson(url, token);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "sentry-unresolved.json"), `${JSON.stringify(issues, null, 2)}\n`);
  writeSummary(outDir, issues.length > 0 ? "UNRESOLVED_ISSUES" : "PASS", [
    `- unresolved_sample_count: \`${issues.length}\``,
    `- project: \`${org}/${project}\``,
  ]);
  process.stdout.write(`SENTRY_ADVISORY_STATUS: ${issues.length > 0 ? "UNRESOLVED_ISSUES" : "PASS"}\n`);
  if (strict && issues.length > 0) process.exit(1);
}

main().catch((error) => {
  process.stderr.write(`[sentry-advisory] FAIL: ${error.message}\n`);
  process.exit(1);
});
