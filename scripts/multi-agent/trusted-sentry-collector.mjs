#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export async function collectSentry({ identity, token, baseSha, headSha, request = fetch }) {
  if (!token || !/^[a-f0-9]{40}$/.test(baseSha || "") || !/^[a-f0-9]{40}$/.test(headSha || "")) throw new Error("Invalid collector identity or credentials.");
  const keys = ["origin", "orgSlug", "projectSlug", "orgId", "projectId"];
  if (!identity || Object.keys(identity).length !== keys.length || keys.some((key) => !Object.hasOwn(identity, key))
    || identity.origin !== "https://sentry.io" || ![identity.orgSlug, identity.projectSlug].every((v) => /^[a-z0-9-]+$/.test(v))
    || ![identity.orgId, identity.projectId].every((v) => /^\d+$/.test(v))) throw new Error("Invalid pinned Sentry target.");
  const base = `${identity.origin}/api/0/projects/${identity.orgSlug}/${identity.projectSlug}/`;
  async function read(url) {
    const response = await request(url, { headers: { Authorization: `Bearer ${token}` }, redirect: "error", signal: AbortSignal.timeout(15000) });
    if (response.status !== 200 || response.redirected) throw new Error("Sentry response rejected.");
    const reader = response.body.getReader(); let size = 0; const chunks = [];
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 1024 * 1024) { await reader.cancel(); throw new Error("Sentry response exceeds limit."); }
        chunks.push(Buffer.from(value));
      }
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch { throw new Error("Sentry response is not valid bounded JSON."); }
    finally { reader.releaseLock(); }
  }
  const project = await read(base);
  if (String(project.id) !== identity.projectId || project.slug !== identity.projectSlug
    || String(project.organization?.id) !== identity.orgId || project.organization?.slug !== identity.orgSlug) throw new Error("Sentry immutable identity mismatch.");
  const issues = await read(`${base}issues/?query=is%3Aunresolved&limit=1`);
  if (!Array.isArray(issues)) throw new Error("Sentry issue response is invalid.");
  return { schemaVersion: 1, status: issues.length ? "UNRESOLVED_ISSUES" : "PASS", unresolvedSampleCount: issues.length,
    baseSha, headSha, targetSha256: createHash("sha256").update(JSON.stringify(identity)).digest("hex") };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (flag) => args[args.indexOf(flag) + 1];
  try {
    if (args.length !== 6 || !["--base", "--head", "--output"].every((flag) => args.indexOf(flag) >= 0)) throw new Error("Invalid collector arguments.");
    const identity = JSON.parse(readFileSync(new URL("../../config/nurseconnect-sentry-target.json", import.meta.url), "utf8"));
    const result = await collectSentry({ identity, token: process.env.SENTRY_AUTH_TOKEN, baseSha: value("--base"), headSha: value("--head") });
    writeFileSync(value("--output"), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
    process.stdout.write(`TRUSTED_SENTRY_STATUS: ${result.status}\n`);
    if (result.status !== "PASS") process.exitCode = 1;
  } catch { process.stderr.write("[trusted-sentry-collector] FAIL: collection rejected; no issue payload retained.\n"); process.exitCode = 1; }
}
