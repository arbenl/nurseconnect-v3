import { describe, expect, it, vi } from "vitest";

import {
  assertSafeDatabase,
  bootstrapSessionViaApp,
  cookieHeaderFromSetCookie,
  getDatabaseName,
  markAuthUserVerifiedForSafeSeed,
  signUpViaApp,
} from "../launch-rehearsal-seed.mjs";

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

  it("sends the app origin during Better Auth sign-up and returns the session cookie", async () => {
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
      );

    const result = await signUpViaApp(
      "http://localhost:3010/",
      {
        email: "launch.admin@test.local",
        name: "Launch Admin",
      },
      fetchMock,
    );

    expect(result).toEqual({
      created: true,
      cookie: "better-auth.session_token=session-secret",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:3010/api/auth/sign-up/email");
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      "content-type": "application/json",
      origin: "http://localhost:3010",
    });
  });

  it("bootstraps the app session after the seed has marked auth email verified", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ ok: true }));

    const result = await bootstrapSessionViaApp(
      "http://localhost:3010/",
      {
        email: "launch.admin@test.local",
        name: "Launch Admin",
      },
      "better-auth.session_token=session-secret",
      fetchMock,
    );

    expect(result).toEqual({ bootstrapped: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:3010/api/me");
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      cookie: "better-auth.session_token=session-secret",
      origin: "http://localhost:3010",
    });
  });

  it("marks an auth user verified for safe launch seed databases", async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [{ id: "auth-user" }],
    });

    await expect(
      markAuthUserVerifiedForSafeSeed({ query }, "launch.admin@test.local"),
    ).resolves.toEqual({ updated: true });

    expect(query.mock.calls[0][0]).toContain("email_verified = true");
    expect(query.mock.calls[0][0]).toContain("email_verified_at");
    expect(query.mock.calls[0][1]).toEqual(["launch.admin@test.local"]);
  });

  it("builds a Cookie header from one or more Set-Cookie values", () => {
    const single = new Headers({
      "set-cookie": "better-auth.session_token=session-secret; Path=/; HttpOnly",
    });
    expect(cookieHeaderFromSetCookie(single)).toBe("better-auth.session_token=session-secret");

    const multiple = {
      getSetCookie: () => [
        "better-auth.session_token=session-secret; Path=/; HttpOnly",
        "better-auth.csrf_token=csrf-secret; Path=/; SameSite=Lax",
      ],
      get: () => null,
    };
    expect(cookieHeaderFromSetCookie(multiple)).toBe(
      "better-auth.session_token=session-secret; better-auth.csrf_token=csrf-secret",
    );

    const combined = new Headers({
      "set-cookie":
        "better-auth.session_token=session-secret; Expires=Wed, 21 Oct 2030 07:28:00 GMT; Path=/; HttpOnly, better-auth.csrf_token=csrf-secret; Path=/; SameSite=Lax",
    });
    expect(cookieHeaderFromSetCookie(combined)).toBe(
      "better-auth.session_token=session-secret; better-auth.csrf_token=csrf-secret",
    );
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
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, { status: 401 }));

    await expect(
      bootstrapSessionViaApp(
        "http://localhost:3010",
        {
          email: "launch.admin@test.local",
          name: "Launch Admin",
        },
        "better-auth.session_token=session-secret",
        fetchMock,
      ),
    ).rejects.toThrow("Session bootstrap failed for launch.admin@test.local: 401");
  });
});
