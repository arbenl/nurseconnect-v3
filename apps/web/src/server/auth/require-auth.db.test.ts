import { db, schema } from "@nurseconnect/database";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();

vi.mock("./get-session", () => ({
  getSession: mockGetSession,
}));

const { authUsers } = schema;

describe("requireAuth email verification enforcement", () => {
  beforeEach(async () => {
    vi.resetModules();
    await db.execute(`TRUNCATE TABLE "auth_users" RESTART IDENTITY CASCADE`);
    mockGetSession.mockReset();
    vi.stubEnv("APP_URL", "https://nurseconnect.test");
    vi.stubEnv("EMAIL_PROVIDER", "postmark");
    vi.stubEnv("EMAIL_FROM", "no-reply@nurseconnect.test");
    vi.stubEnv("POSTMARK_SERVER_TOKEN", "test-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("denies an unverified auth user in enforce mode", async () => {
    vi.stubEnv("NC_EMAIL_VERIFICATION_MODE", "enforce");
    await db.insert(authUsers).values({
      id: "auth_unverified",
      email: "unverified@test.local",
      emailVerified: false,
    });
    mockGetSession.mockResolvedValue({
      user: {
        id: "auth_unverified",
        email: "unverified@test.local",
      },
    });

    const { requireAuth } = await import("./require-auth");

    await expect(requireAuth()).rejects.toMatchObject({ name: "UnauthorizedError" });
  });

  it("treats an unverified auth user as unauthenticated for session-user resolution in enforce mode", async () => {
    vi.stubEnv("NC_EMAIL_VERIFICATION_MODE", "enforce");
    await db.insert(authUsers).values({
      id: "auth_unverified_session_user",
      email: "unverified-session@test.local",
      emailVerified: false,
    });
    mockGetSession.mockResolvedValue({
      user: {
        id: "auth_unverified_session_user",
        email: "unverified-session@test.local",
      },
    });

    const { resolveCurrentSessionUser } = await import("./session-user");

    await expect(resolveCurrentSessionUser()).resolves.toBeNull();
  });

  it("allows an unverified auth user in off mode", async () => {
    vi.stubEnv("NC_EMAIL_VERIFICATION_MODE", "off");
    const session = {
      user: {
        id: "auth_off_unverified",
        email: "off-unverified@test.local",
      },
    };
    mockGetSession.mockResolvedValue(session);

    const { requireAuth } = await import("./require-auth");

    await expect(requireAuth()).resolves.toBe(session);
  });

  it("allows a verified auth user in enforce mode", async () => {
    vi.stubEnv("NC_EMAIL_VERIFICATION_MODE", "enforce");
    await db.insert(authUsers).values({
      id: "auth_verified",
      email: "verified@test.local",
      emailVerified: true,
    });
    const session = {
      user: {
        id: "auth_verified",
        email: "verified@test.local",
      },
    };
    mockGetSession.mockResolvedValue(session);

    const { requireAuth } = await import("./require-auth");

    await expect(requireAuth()).resolves.toBe(session);
  });

  it("logs but allows an unverified auth user in observe mode", async () => {
    vi.stubEnv("NC_EMAIL_VERIFICATION_MODE", "observe");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await db.insert(authUsers).values({
      id: "auth_observe",
      email: "observe@test.local",
      emailVerified: false,
    });
    const session = {
      user: {
        id: "auth_observe",
        email: "observe@test.local",
      },
    };
    mockGetSession.mockResolvedValue(session);

    const { requireAuth } = await import("./require-auth");

    await expect(requireAuth()).resolves.toBe(session);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("auth.unverified_access"));
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("observe@test.local"));
  });
});
