import { assertPinnedSentryIdentity, resolveSentryTarget, SentryFailure } from "./sentry-target.mjs";

export async function readSentryState({ identity, token, env = process.env, request = fetch, limit = 5 } = {}) {
  const resolved = resolveSentryTarget(env);
  const target = assertPinnedSentryIdentity(identity === undefined ? resolved.identity : identity);
  if (!Number.isInteger(limit) || limit < 1 || limit > 5) throw new SentryFailure("FORBIDDEN_CONFIG");
  const text = value => typeof value === "string" ? value.trim() : "";
  const credential = token === undefined ? text(env.NURSECONNECT_SENTRY_AUTH_TOKEN) || text(env.SENTRY_AUTH_TOKEN) : text(token);
  if (!credential) throw new SentryFailure("MISSING_CONFIG");
  if (/[^\x21-\x7e]/.test(credential)) throw new SentryFailure("FORBIDDEN_CONFIG");
  const base = `${target.origin}/api/0/projects/${target.orgSlug}/${target.projectSlug}/`;
  async function read(url) {
    let reader;
    try {
      const response = await request(url, { headers: { Authorization: `Bearer ${credential}` }, redirect: "error", signal: AbortSignal.timeout(15000) });
      if (response.redirected) throw new SentryFailure("SENTRY_RESPONSE_REJECTED");
      if (response.status !== 200) throw new SentryFailure(`SENTRY_HTTP_${Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : 0}`);
      reader = response.body.getReader(); let size = 0; const chunks = [];
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 1024 * 1024) { await reader.cancel(); throw new SentryFailure("SENTRY_INVALID_RESPONSE"); }
        chunks.push(Buffer.from(value));
      }
      try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
      catch { throw new SentryFailure("SENTRY_INVALID_RESPONSE"); }
    } catch (error) {
      if (error instanceof SentryFailure) throw error;
      throw new SentryFailure("SENTRY_REQUEST_FAILED");
    } finally { reader?.releaseLock(); }
  }
  const project = await read(base);
  if (!project || String(project.id) !== target.projectId || project.slug !== target.projectSlug
    || String(project.organization?.id) !== target.orgId || project.organization?.slug !== target.orgSlug) {
    throw new SentryFailure("SENTRY_IDENTITY_MISMATCH");
  }
  const issues = await read(`${base}issues/?query=is%3Aunresolved&limit=${limit}`);
  if (!Array.isArray(issues) || issues.length > limit || issues.some(issue => !issue || typeof issue !== "object" || Array.isArray(issue))) {
    throw new SentryFailure("SENTRY_INVALID_RESPONSE");
  }
  return { identity: target, unresolvedSampleCount: issues.length };
}
