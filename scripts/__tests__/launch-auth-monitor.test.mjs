import { afterEach, describe, expect, it, vi } from "vitest";

import {
  extractSessionCookie,
  parseArgs,
  renderHuman,
  renderJson,
  runAuthMonitor,
} from "../launch-auth-monitor.mjs";

const baseOptions = {
  baseUrl: "https://nurseconnect.test",
  email: "synthetic-admin@test.local",
  password: "super-secret-password",
  timeoutMs: 1000,
  json: false,
  help: false,
};

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: init.headers,
  });
}

describe("launch-auth-monitor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses env defaults and command flags", () => {
    const parsed = parseArgs(
      ["--", "--url", "https://override.test/", "--email=flag@test.local", "--json"],
      {
        LAUNCH_AUTH_MONITOR_URL: "https://env.test",
        LAUNCH_AUTH_MONITOR_EMAIL: "env@test.local",
        LAUNCH_AUTH_MONITOR_PASSWORD: "env-secret",
      },
    );

    expect(parsed).toMatchObject({
      baseUrl: "https://override.test",
      email: "flag@test.local",
      password: "env-secret",
      json: true,
    });
  });

  it("rejects plaintext non-localhost targets before credentials can be sent", () => {
    expect(() =>
      parseArgs(["--url", "http://production.example.com"], {
        LAUNCH_AUTH_MONITOR_EMAIL: "env@test.local",
        LAUNCH_AUTH_MONITOR_PASSWORD: "env-secret",
      }),
    ).toThrow("Auth monitor URL must use HTTPS except for localhost development targets");

    expect(
      parseArgs(["--url", "http://localhost:3010"], {
        LAUNCH_AUTH_MONITOR_EMAIL: "env@test.local",
        LAUNCH_AUTH_MONITOR_PASSWORD: "env-secret",
      }).baseUrl,
    ).toBe("http://localhost:3010");
  });

  it("prints help without validating a misconfigured default URL", () => {
    expect(
      parseArgs(["--help"], {
        LAUNCH_AUTH_MONITOR_URL: "not-a-valid-url",
      }),
    ).toMatchObject({
      baseUrl: "not-a-valid-url",
      help: true,
    });
  });

  it("extracts only the redacted session cookie pair", () => {
    expect(
      extractSessionCookie([
        "other=value; Path=/",
        "better-auth.session_token=session-secret; Path=/; HttpOnly; Secure",
      ]),
    ).toBe("better-auth.session_token=session-secret");

    expect(
      extractSessionCookie([
        "__Secure-better-auth.session_token=secure-session-secret; Path=/; HttpOnly; Secure",
      ]),
    ).toBe("__Secure-better-auth.session_token=secure-session-secret");
  });

  it("fails before network calls when credentials are missing", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const result = await runAuthMonitor({ ...baseOptions, email: "", password: "" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([
      "synthetic admin email is missing",
      "synthetic admin password is missing",
    ]);
  });

  it("validates sign-in, session bootstrap, admin ping, and sign-out", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(
          { user: { id: "auth-user" } },
          {
            headers: {
              "set-cookie": "better-auth.session_token=session-secret; Path=/; HttpOnly",
            },
          },
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true, user: { role: "admin" } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, user: { role: "admin" } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const result = await runAuthMonitor(baseOptions);
    const human = renderHuman(result);
    const json = renderJson(result);

    expect(result.ok).toBe(true);
    expect(result.timeoutMs).toBe(1000);
    expect(result.steps.map((step) => step.name)).toEqual([
      "sign-in",
      "/api/me",
      "/api/admin/ping",
      "sign-out",
    ]);
    expect(human).toContain("sessionCookie=present");
    expect(human).not.toContain("session-secret");
    expect(human).not.toContain(baseOptions.password);
    expect(json).not.toContain("session-secret");
    expect(json).not.toContain(baseOptions.password);
  });

  it("fails when the authenticated user is not an admin", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(
          { user: { id: "auth-user" } },
          {
            headers: {
              "set-cookie": "better-auth.session_token=session-secret; Path=/; HttpOnly",
            },
          },
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true, user: { role: "patient" } }))
      .mockResolvedValueOnce(jsonResponse({ error: "Forbidden" }, { status: 403 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const result = await runAuthMonitor(baseOptions);

    expect(result.ok).toBe(false);
    expect(result.failures).toContain("/api/me user role is patient, expected admin");
    expect(result.failures).toContain("/api/admin/ping returned HTTP 403");
  });

  it("warns without failing when sign-out fails after positive auth checks", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(
          { user: { id: "auth-user" } },
          {
            headers: {
              "set-cookie": "better-auth.session_token=session-secret; Path=/; HttpOnly",
            },
          },
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true, user: { role: "admin" } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, user: { role: "admin" } }))
      .mockResolvedValueOnce(jsonResponse({ error: "Temporary failure" }, { status: 500 }));

    const result = await runAuthMonitor(baseOptions);

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([
      "sign-out returned HTTP 500; rotate or expire the synthetic session manually",
    ]);
  });
});
