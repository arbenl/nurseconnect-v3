import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dbUpdate: vi.fn(),
  dbSet: vi.fn(),
  dbWhere: vi.fn(),
  dbReturning: vi.fn(),
  eq: vi.fn((left: unknown, right: unknown) => ({ left, right })),
  buildProfileUpdatePatch: vi.fn(),
  resolveCurrentSessionUser: vi.fn(),
  authErrorResponse: vi.fn(),
  createApiLogContext: vi.fn(),
  logApiFailure: vi.fn(),
  logApiStart: vi.fn(),
  logApiSuccess: vi.fn(),
  withRequestId: vi.fn((response: Response) => response),
  users: {
    id: "users.id",
    authId: "users.authId",
  },
}));

vi.mock("@nurseconnect/database", () => ({
  db: { update: mocks.dbUpdate },
  eq: mocks.eq,
  schema: { users: mocks.users },
}));

vi.mock("@nurseconnect/domain-identity", () => ({
  ProfileValidationError: class ProfileValidationError extends Error {
    details = [];
  },
  buildProfileUpdatePatch: mocks.buildProfileUpdatePatch,
}));

vi.mock("@/server/auth", () => ({
  authErrorResponse: mocks.authErrorResponse,
  resolveCurrentSessionUser: mocks.resolveCurrentSessionUser,
}));

vi.mock("@/server/telemetry/ops-logger", () => ({
  createApiLogContext: mocks.createApiLogContext,
  logApiFailure: mocks.logApiFailure,
  logApiStart: mocks.logApiStart,
  logApiSuccess: mocks.logApiSuccess,
  withRequestId: mocks.withRequestId,
}));

import { PATCH } from "./route";

describe("PATCH /api/me/profile", () => {
  beforeEach(() => {
    mocks.dbUpdate.mockReset();
    mocks.dbSet.mockReset();
    mocks.dbWhere.mockReset();
    mocks.dbReturning.mockReset();
    mocks.eq.mockClear();
    mocks.buildProfileUpdatePatch.mockReset();
    mocks.resolveCurrentSessionUser.mockReset();
    mocks.authErrorResponse.mockReset();
    mocks.createApiLogContext.mockReturnValue({
      requestId: "req-profile",
      path: "/api/me/profile",
    });
    mocks.logApiFailure.mockReset();
    mocks.logApiStart.mockReset();
    mocks.logApiSuccess.mockReset();
    mocks.withRequestId.mockClear();

    mocks.dbUpdate.mockReturnValue({ set: mocks.dbSet });
    mocks.dbSet.mockReturnValue({ where: mocks.dbWhere });
    mocks.dbWhere.mockReturnValue({ returning: mocks.dbReturning });
    mocks.authErrorResponse.mockReturnValue(null);
  });

  it("updates the resolved domain user id and logs the resolved role", async () => {
    mocks.resolveCurrentSessionUser.mockResolvedValue({
      session: { user: { id: "auth-admin-1", email: "admin@test.local" } },
      user: { id: "domain-admin-1", authId: "auth-admin-1", email: "admin@test.local", role: "admin" },
    });
    mocks.buildProfileUpdatePatch.mockReturnValue({ firstName: "Ada" });
    mocks.dbReturning.mockResolvedValue([
      {
        id: "domain-admin-1",
        authId: "auth-admin-1",
        email: "admin@test.local",
        role: "admin",
        firstName: "Ada",
        lastName: "Lovelace",
        phone: "555-0100",
        city: "Boston",
        address: "redacted",
        profileCompletedAt: new Date("2026-06-04T00:00:00.000Z"),
      },
    ]);

    const response = await PATCH(new Request("https://app.test/api/me/profile", {
      method: "PATCH",
      body: JSON.stringify({ firstName: "Ada" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.eq).toHaveBeenCalledWith(mocks.users.id, "domain-admin-1");
    expect(mocks.eq).not.toHaveBeenCalledWith(mocks.users.authId, "auth-admin-1");
    expect(mocks.logApiSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "domain-admin-1", actorRole: "admin" }),
      200,
      expect.any(Number),
      expect.objectContaining({ targetUserId: "domain-admin-1", source: "me.profile" }),
    );
    expect(body).toMatchObject({
      ok: true,
      user: {
        id: "domain-admin-1",
        authId: "auth-admin-1",
        role: "admin",
        profileComplete: true,
      },
    });
  });

  it("keeps missing central session resolution as a JSON 401", async () => {
    mocks.resolveCurrentSessionUser.mockResolvedValue(null);

    const response = await PATCH(new Request("https://app.test/api/me/profile", {
      method: "PATCH",
      body: JSON.stringify({ firstName: "Ada" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mocks.dbUpdate).not.toHaveBeenCalled();
    expect(mocks.logApiFailure).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "req-profile" }),
      "Unauthorized",
      401,
      expect.any(Number),
      expect.objectContaining({ source: "me.profile" }),
    );
  });
});
