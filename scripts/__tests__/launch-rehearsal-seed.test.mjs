import { describe, expect, it, vi } from "vitest";

import { assertSafeDatabase, getDatabaseName, signUpViaApp } from "../launch-rehearsal-seed.mjs";

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: init.headers,
  });
}

describe("launch-rehearsal-seed", () => {
  it("derives the database name and rejects unsafe production-like databases", () => {
    expect(getDatabaseName("postgresql://postgres:postgres@localhost:5432/nurseconnect_test")).toBe(
      "nurseconnect_test",
    );
    expect(assertSafeDatabase("postgresql://postgres:postgres@localhost:5432/nurseconnect_test")).toBe(
      "nurseconnect_test",
    );
    expect(() =>
      assertSafeDatabase("postgresql://postgres:postgres@localhost:5432/nurseconnect"),
    ).toThrow("Refusing to seed non-test database");
  });

  it("sends the app origin during Better Auth sign-up and session bootstrap", async () => {
    const fetchMock = vi
      .fn()
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
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const result = await signUpViaApp(
      "http://localhost:3010/",
      {
        email: "launch.admin@test.local",
        name: "Launch Admin",
      },
      fetchMock,
    );

    expect(result).toEqual({ created: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:3010/api/auth/sign-up/email");
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      "content-type": "application/json",
      origin: "http://localhost:3010",
    });
    expect(fetchMock.mock.calls[1][0]).toBe("http://localhost:3010/api/me");
    expect(fetchMock.mock.calls[1][1].headers).toMatchObject({
      cookie: "better-auth.session_token=session-secret; Path=/; HttpOnly",
      origin: "http://localhost:3010",
    });
  });

  it("treats duplicate sign-up responses as existing users", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ code: "USER_EXISTS" }, { status: 409 }));

    await expect(
      signUpViaApp(
        "https://staging.example.com",
        {
          email: "launch.admin@test.local",
          name: "Launch Admin",
        },
        fetchMock,
      ),
    ).resolves.toEqual({ created: false });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers.origin).toBe("https://staging.example.com");
  });

  it("fails when post-sign-up session bootstrap fails", async () => {
    const fetchMock = vi
      .fn()
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
      .mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, { status: 401 }));

    await expect(
      signUpViaApp(
        "http://localhost:3010",
        {
          email: "launch.admin@test.local",
          name: "Launch Admin",
        },
        fetchMock,
      ),
    ).rejects.toThrow("Session bootstrap failed for launch.admin@test.local: 401");
  });
});
