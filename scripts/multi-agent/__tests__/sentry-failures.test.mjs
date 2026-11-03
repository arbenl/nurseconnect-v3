import { describe, expect, it } from "vitest";
import { readSentryState } from "../sentry-client.mjs";
import { advisory, pin, project, sentinel } from "./sentry-cli-harness.mjs";

const env = { SENTRY_AUTH_TOKEN: "fixture-token" };
describe("Sentry fail-closed transport", () => {
  it.each([301, 302, 401, 403, 429, 500])("rejects HTTP %s without persisting provider content", status => {
    const r = advisory({ env, responses: [{ status, raw: sentinel }] });
    expect(r.status).toBe(1); expect(r.calls).toHaveLength(1);
    expect(JSON.stringify(r.contents) + r.stdout + r.stderr).not.toContain(sentinel);
  });
  it("rejects a redirected 200 response", () => {
    const r = advisory({ env, responses: [{ body: project, redirected: true }] });
    expect(r.status).toBe(1); expect(r.calls).toHaveLength(1); expect(r.stderr).toContain("SENTRY_RESPONSE_REJECTED");
  });
  it.each([0, 6, 1.5])("rejects out-of-range limit %s before network access", async limit => {
    let calls = 0;
    await expect(readSentryState({ identity: pin, token: "fixture-token", limit, request: async () => { calls += 1; } }))
      .rejects.toMatchObject({ message: "FORBIDDEN_CONFIG" });
    expect(calls).toBe(0);
  });
  it("rejects a renamed or recreated project before querying issues", () => {
    const r = advisory({ env, responses: [{ ...project, id: "999" }, []] });
    expect(r.status).toBe(1); expect(r.calls).toHaveLength(1);
  });
  it("rejects immutable organization mismatch", () => {
    const r = advisory({ env, responses: [{ ...project, organization: { ...project.organization, id: "999" } }, []] });
    expect(r.status).toBe(1); expect(r.calls).toHaveLength(1);
  });
  it.each([{}, null, [null], "invalid"])("rejects invalid issue response %j", body => {
    const r = advisory({ env, responses: [project, { raw: JSON.stringify(body) }] });
    expect(r.status).toBe(1); expect(r.calls).toHaveLength(2);
  });
  it("rejects invalid JSON and oversized bodies", () => {
    for (const raw of ["{invalid", "x".repeat(1024 * 1024 + 1)]) {
      const r = advisory({ env, responses: [{ raw }] }); expect(r.status).toBe(1); expect(r.calls).toHaveLength(1);
    }
  });
  it.each(["TimeoutError", sentinel])("sanitizes transport failure %s", failure => {
    const r = advisory({ env, failure }); expect(r.status).toBe(1); expect(r.calls).toHaveLength(1);
    expect(JSON.stringify(r.contents) + r.stdout + r.stderr).not.toContain(failure);
  });
});
