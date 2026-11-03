import { describe, expect, it } from "vitest";
import { advisory, pin, project, sentinel } from "./sentry-cli-harness.mjs";

const token = { SENTRY_AUTH_TOKEN: "fixture-token" };
describe("Sentry CLI isolation and evidence", () => {
  it("uses the pinned target without ambient identity and retains only allowlisted evidence", () => {
    const r = advisory({ env: token });
    expect(r.status).toBe(0); expect(r.stdout).toContain("SENTRY_ADVISORY_STATUS: PASS");
    expect(r.evidence).toEqual({ schemaVersion: 1, status: "PASS", checkedAt: expect.any(String), identity: pin, unresolvedSampleCount: 0 });
    expect(Number.isFinite(Date.parse(r.evidence.checkedAt))).toBe(true);
    expect(r.calls).toHaveLength(2);
    expect(r.calls[1]?.url).toBe(`${pin.origin}/api/0/projects/${pin.orgSlug}/${pin.projectSlug}/issues/?query=is%3Aunresolved&limit=5`);
    expect(r.calls.every(c => c.url.startsWith(`${pin.origin}/api/0/projects/${pin.orgSlug}/${pin.projectSlug}/`) && c.redirect === "error" && c.hasSignal && c.authorized)).toBe(true);
  });
  it("ignores polluted local generic identity without exporting its values", () => {
    const r = advisory({ env: { ...token, SENTRY_ORG: "foreign", SENTRY_PROJECT: sentinel, SENTRY_BASE_URL: "http://foreign.invalid" } });
    expect(r.status).toBe(0); expect(r.stderr).toContain("ignored local generic identity");
    expect(JSON.stringify(r.contents) + r.stdout + r.stderr).not.toContain(sentinel);
    expect(r.evidence.identity).toEqual(pin);
  });
  it("prefers a dedicated credential without leaking the ambient account credential", () => {
    const r = advisory({ env: { SENTRY_AUTH_TOKEN: sentinel, NURSECONNECT_SENTRY_AUTH_TOKEN: "fixture-token" } });
    expect(r.status).toBe(0); expect(r.calls.every(c => c.authorized)).toBe(true);
    expect(JSON.stringify(r.contents) + r.stdout + r.stderr).not.toContain(sentinel);
  });
  it.each(["true", "TRUE", "1"])("rejects CI=%s generic drift before any request", CI => {
    const r = advisory({ env: { ...token, CI, SENTRY_PROJECT: "foreign" } });
    expect(r.status).toBe(1); expect(r.calls).toEqual([]);
  });
  it.each(["true", "TRUE", "1"])("accepts CI=%s generic identity only when it matches the pin", CI => {
    const r = advisory({ env: { ...token, CI, SENTRY_ORG: pin.orgSlug, SENTRY_PROJECT: pin.projectSlug, SENTRY_BASE_URL: pin.origin } });
    expect(r.status).toBe(0); expect(r.calls).toHaveLength(2); expect(r.evidence.identity).toEqual(pin);
  });
  it.each(["true", "TRUE", "1"])("rejects CI=%s advisory override", CI => {
    const r = advisory({ strict: false, env: { CI, SENTRY_ADVISORY_MODE: "advisory" } });
    expect(r.status).toBe(1); expect(r.stderr).toContain("advisory mode is forbidden in CI"); expect(r.calls).toEqual([]);
  });
  it.each(["NURSECONNECT_SENTRY_ORG", "NURSECONNECT_SENTRY_PROJECT", "NURSECONNECT_SENTRY_BASE_URL"])("rejects %s mismatch even without credentials", key => {
    const r = advisory({ strict: false, env: { [key]: sentinel } });
    expect(r.status).toBe(1); expect(r.calls).toEqual([]); expect(r.stderr).toContain("FORBIDDEN_CONFIG");
    expect(JSON.stringify(r.contents) + r.stderr).not.toContain(sentinel);
  });
  it.each(["", "   "])("treats blank credentials as missing", value => {
    const r = advisory({ strict: false, env: { SENTRY_AUTH_TOKEN: value } });
    expect(r.status).toBe(0); expect(r.stdout).toContain("MISSING_CONFIG"); expect(r.calls).toEqual([]);
  });
  it("rejects non-printable credentials before network access", () => {
    const r = advisory({ env: { SENTRY_AUTH_TOKEN: "fixture\ntoken" } });
    expect(r.status).toBe(1); expect(r.stderr).toContain("FORBIDDEN_CONFIG"); expect(r.calls).toEqual([]);
  });
  it("fails strict missing credentials without network access", () => {
    const r = advisory(); expect(r.status).toBe(1); expect(r.calls).toEqual([]);
  });
  it("fails strict unresolved issues while retaining no issue payload", () => {
    const r = advisory({ env: token, responses: [project, [{ id: "fixture", title: sentinel, metadata: { private: sentinel } }]] });
    expect(r.status).toBe(1); expect(r.evidence).toEqual(expect.objectContaining({ status: "UNRESOLVED_ISSUES", unresolvedSampleCount: 1 }));
    expect(JSON.stringify(r.contents) + r.stdout + r.stderr).not.toContain(sentinel);
  });
});
