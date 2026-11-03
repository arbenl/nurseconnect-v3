#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { asString, parseArgv } from "./lib/cli.mjs";
import { pinnedSentryIdentity, resolveSentryTarget } from "./sentry-target.mjs";
import { readSentryState } from "./sentry-client.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const safeCodes = new Set(["MISSING_CONFIG", "FORBIDDEN_CONFIG", "CI_ADVISORY_FORBIDDEN", "SENTRY_RESPONSE_REJECTED", "SENTRY_REQUEST_FAILED", "SENTRY_INVALID_RESPONSE", "SENTRY_IDENTITY_MISMATCH"]);
export async function runSentryAdvisory(argv = process.argv.slice(2), env = process.env, request = fetch) {
  const args = parseArgv(argv), chosen = asString(args["run-root"], "") || "tmp/multi-agent/sentry-advisory";
  const runRoot = path.isAbsolute(chosen) ? chosen : path.join(root, chosen);
  const strict = args.strict === true || args.strict === "true", outDir = path.join(runRoot, "evidence/sentry");
  let status = "ERROR", count = null, code = "", identity = null;
  try {
    identity = pinnedSentryIdentity();
    const context = resolveSentryTarget(env);
    if (context.ignoredGenericKeys.length) process.stderr.write(`[sentry-advisory] ignored local generic identity: ${context.ignoredGenericKeys.join(", ")}\n`);
    const result = await readSentryState({ env, request });
    count = result.unresolvedSampleCount; status = count ? "UNRESOLVED_ISSUES" : "PASS";
  } catch (error) {
    code = safeCodes.has(error.code) || /^SENTRY_HTTP_\d{1,3}$/.test(error.code || "") ? error.code : "SENTRY_REQUEST_FAILED";
    status = code === "MISSING_CONFIG" ? code : ["FORBIDDEN_CONFIG", "CI_ADVISORY_FORBIDDEN"].includes(code) ? "FORBIDDEN_CONFIG" : "ERROR";
  }
  // Construct fresh operational evidence; provider objects and errors never enter it.
  const evidence = { schemaVersion: 1, status, checkedAt: new Date().toISOString(), identity, unresolvedSampleCount: count };
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "sentry-unresolved.json"), `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  writeFileSync(path.join(outDir, "sentry-summary.md"), ["# Sentry Advisory Summary", "", `- status: \`${status}\``, `- checked_at: \`${evidence.checkedAt}\``,
    `- project: \`${identity ? `${identity.orgSlug}/${identity.projectSlug}` : "invalid pin"}\``, `- unresolved_sample_count: \`${count ?? "not queried"}\``].join("\n"));
  process.stdout.write(`SENTRY_ADVISORY_STATUS: ${status}\n`);
  if (code && code !== "MISSING_CONFIG") process.stderr.write(`[sentry-advisory] FAIL: ${code}${code === "CI_ADVISORY_FORBIDDEN" ? "; advisory mode is forbidden in CI" : ""}\n`);
  if (status === "PASS" || (!strict && ["MISSING_CONFIG", "UNRESOLVED_ISSUES"].includes(status))) return 0;
  return 1;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSentryAdvisory().then(code => { process.exitCode = code; }).catch(() => {
    process.stderr.write("[sentry-advisory] FAIL: evidence operation rejected\n"); process.exitCode = 1;
  });
}
