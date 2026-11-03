import { describe, expect, it } from "vitest";
import { collectSentry } from "../trusted-sentry-collector.mjs";
import { pinnedSentryIdentity } from "../sentry-target.mjs";
const identity = pinnedSentryIdentity();
const project = { id: identity.projectId, slug: identity.projectSlug, organization: { id: identity.orgId, slug: identity.orgSlug } };
const baseSha = "a".repeat(40), headSha = "b".repeat(40);
const targetSha256 = "11d026ba1d8faff0e18d627335d777017466b0b7a3cad9c11910410ea0b7bc16";
function collector(overrides = {}, bodies = [project, []]) {
  const urls = []; const calls = [];
  const request = async (url, options) => {
    urls.push(url); calls.push(options);
    const body = bodies.shift();
    return body instanceof Response ? body : new Response(JSON.stringify(body));
  };
  return { result: collectSentry({ identity, token: "fixture-token", baseSha, headSha, request, ...overrides }), urls, calls };
}
describe("trusted Sentry collector boundary", () => {
  it("binds count-only evidence to immutable target and actual head/base", async () => {
    const { result, urls, calls } = collector();
    expect(await result).toEqual({ schemaVersion: 1, status: "PASS", unresolvedSampleCount: 0, baseSha, headSha, targetSha256 });
    expect(urls).toHaveLength(2);
    expect(calls.every((call) => call.redirect === "error")).toBe(true);
  });
  it("retains no synthetic issue payload when strict unresolved status fails", async () => {
    const { result } = collector({}, [project, [{ title: "SYNTHETIC_SENSITIVE_FIXTURE", metadata: { synthetic: "private" } }]]);
    const evidence = await result;
    expect(evidence.status).toBe("UNRESOLVED_ISSUES");
    expect(JSON.stringify(evidence)).not.toMatch(/SYNTHETIC|metadata|private/);
  });
  it.each([
    ["missing token", { token: "" }], ["blank token", { token: "   " }], ["invalid head", { headSha: "forged" }],
    ["missing identity", { identity: undefined }],
    ["different project on approved origin", { identity: { ...identity, projectSlug: "other-project" } }],
    ["alternate origin", { identity: { ...identity, origin: "https://example.invalid" } }],
    ["path injection", { identity: { ...identity, orgSlug: "../other" } }],
    ["unknown target key", { identity: { ...identity, extra: "unknown" } }],
  ])("rejects %s before sending any credential", async (_name, overrides) => {
    const { result, urls } = collector(overrides);
    await expect(result).rejects.toThrow(); expect(urls).toEqual([]);
  });
  it.each([301, 401, 403, 429, 500])("fails closed for HTTP %s", async (status) => {
    await expect(collector({}, [new Response("rejected", { status })]).result).rejects.toThrow();
  });
  it("rejects mismatched project before querying issues", async () => {
    const { result, urls } = collector({}, [{ ...project, id: "999" }]);
    await expect(result).rejects.toThrow("SENTRY_IDENTITY_MISMATCH"); expect(urls).toHaveLength(1);
  });
  it("rejects malformed and oversized issue bodies", async () => {
    await expect(collector({}, [project, {}]).result).rejects.toThrow();
    await expect(collector({}, [new Response("x".repeat(1024 * 1024 + 1))]).result).rejects.toThrow();
  });
  it("rejects transport failure without leaking provider body or token", async () => {
    const request = async () => { throw new Error("transport"); };
    await expect(collector({ request }).result).rejects.toThrow("SENTRY_REQUEST_FAILED");
  });
});
