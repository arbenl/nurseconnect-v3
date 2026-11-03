#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readSentryState } from "./sentry-client.mjs";
import { assertPinnedSentryIdentity } from "./sentry-target.mjs";

export async function collectSentry({ identity, token, env = token === undefined ? process.env : {}, baseSha, headSha, request = fetch }) {
  if (!/^[a-f0-9]{40}$/.test(baseSha || "") || !/^[a-f0-9]{40}$/.test(headSha || "")) throw new Error("Invalid collector identity.");
  const target = assertPinnedSentryIdentity(identity);
  const result = await readSentryState({ identity: target, token, env, request, limit: 1 });
  return { schemaVersion: 1, status: result.unresolvedSampleCount ? "UNRESOLVED_ISSUES" : "PASS", unresolvedSampleCount: result.unresolvedSampleCount,
    baseSha, headSha, targetSha256: createHash("sha256").update(JSON.stringify(target)).digest("hex") };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (flag) => args[args.indexOf(flag) + 1];
  try {
    if (args.length !== 6 || !["--base", "--head", "--output"].every((flag) => args.indexOf(flag) >= 0)) throw new Error("Invalid collector arguments.");
    const identity = JSON.parse(readFileSync(new URL("../../config/nurseconnect-sentry-target.json", import.meta.url), "utf8"));
    const result = await collectSentry({ identity, baseSha: value("--base"), headSha: value("--head") });
    writeFileSync(value("--output"), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
    process.stdout.write(`TRUSTED_SENTRY_STATUS: ${result.status}\n`);
    if (result.status !== "PASS") process.exitCode = 1;
  } catch { process.stderr.write("[trusted-sentry-collector] FAIL: collection rejected; no issue payload retained.\n"); process.exitCode = 1; }
}
