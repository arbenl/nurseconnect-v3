import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const repo = fileURLToPath(new URL("../../..", import.meta.url));
export const pin = JSON.parse(readFileSync(join(repo, "config/nurseconnect-sentry-target.json"), "utf8"));
export const project = { id: pin.projectId, slug: pin.projectSlug, organization: { id: pin.orgId, slug: pin.orgSlug } };
export const sentinel = "SYNTHETIC_PRIVATE_PAYLOAD_MUST_NOT_PERSIST";

export function advisory({ env = {}, responses = [project, []], strict = true, failure } = {}) {
  const root = mkdtempSync(join(tmpdir(), "nc-sentry-isolation-"));
  try {
    const trace = join(root, "requests.json"), loader = join(root, "network-fixture.mjs");
    writeFileSync(loader, `
import https from 'node:https';
import {writeFileSync} from 'node:fs';
https.request = () => { throw Error('Unexpected legacy transport'); };
const responses = ${JSON.stringify(responses)}, trace = ${JSON.stringify(trace)}, failure = ${JSON.stringify(failure || "")};
const calls = [];
globalThis.fetch = async (url, options) => {
 calls.push({url:String(url),redirect:options.redirect,hasSignal:options.signal instanceof AbortSignal,authorized:options.headers.Authorization === 'Bearer fixture-token'});
 writeFileSync(trace, JSON.stringify(calls));
 if (failure) throw Error(failure);
 const next = responses.shift();
 const response = new Response(next?.raw ?? JSON.stringify(next?.body ?? next), {status:next?.status ?? 200});
 if (next?.redirected === true) Object.defineProperty(response, 'redirected', {value:true});
 return response;
};
`);
    const result = spawnSync(process.execPath, ["--import", loader, join(repo, "scripts/multi-agent/sentry-advisory.mjs"), "--run-root", root, ...(strict ? ["--strict"] : [])], {
      cwd: repo, encoding: "utf8", timeout: 10000, env: { PATH: process.env.PATH, ...env },
    });
    const out = join(root, "evidence/sentry"), files = existsSync(out) ? readdirSync(out) : [];
    const contents = Object.fromEntries(files.map(name => [name, readFileSync(join(out, name), "utf8")]));
    return { ...result, calls: existsSync(trace) ? JSON.parse(readFileSync(trace, "utf8")) : [], contents,
      evidence: contents["sentry-unresolved.json"] ? JSON.parse(contents["sentry-unresolved.json"]) : null };
  } finally { rmSync(root, { recursive: true, force: true }); }
}
