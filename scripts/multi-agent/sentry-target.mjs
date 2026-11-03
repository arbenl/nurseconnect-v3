import { readFileSync } from "node:fs";

export class SentryFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}
const keys = ["origin", "orgSlug", "projectSlug", "orgId", "projectId"];
let pinned;
export function pinnedSentryIdentity() {
  if (!pinned) {
    try { pinned = JSON.parse(readFileSync(new URL("../../config/nurseconnect-sentry-target.json", import.meta.url), "utf8")); }
    catch { throw new SentryFailure("FORBIDDEN_CONFIG"); }
    if (!pinned || Object.keys(pinned).length !== keys.length || keys.some(k => !Object.hasOwn(pinned, k))
      || pinned.origin !== "https://sentry.io" || ![pinned.orgSlug, pinned.projectSlug].every(v => typeof v === "string" && /^[a-z0-9-]+$/.test(v))
      || ![pinned.orgId, pinned.projectId].every(v => typeof v === "string" && /^\d+$/.test(v))) {
      pinned = undefined; throw new SentryFailure("FORBIDDEN_CONFIG");
    }
    Object.freeze(pinned);
  }
  return { ...pinned };
}
export function assertPinnedSentryIdentity(identity) {
  const expected = pinnedSentryIdentity();
  if (!identity || Object.keys(identity).length !== keys.length || keys.some(k => identity[k] !== expected[k])) {
    throw new SentryFailure("FORBIDDEN_CONFIG");
  }
  return expected;
}
export function resolveSentryTarget(env = process.env) {
  const identity = pinnedSentryIdentity(), ci = /^(true|1)$/i.test(String(env.CI || "").trim());
  if (ci && env.SENTRY_ADVISORY_MODE === "advisory") throw new SentryFailure("CI_ADVISORY_FORBIDDEN");
  const fields = { ORG: "orgSlug", PROJECT: "projectSlug", BASE_URL: "origin" }, ignoredGenericKeys = [];
  for (const [suffix, field] of Object.entries(fields)) {
    const dedicated = `NURSECONNECT_SENTRY_${suffix}`, generic = `SENTRY_${suffix}`;
    if (Object.hasOwn(env, dedicated) && env[dedicated] !== identity[field]) throw new SentryFailure("FORBIDDEN_CONFIG");
    if (Object.hasOwn(env, generic) && env[generic] !== identity[field]) {
      if (ci) throw new SentryFailure("FORBIDDEN_CONFIG");
      ignoredGenericKeys.push(generic);
    }
  }
  return { identity, ignoredGenericKeys };
}
