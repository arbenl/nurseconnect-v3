import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getVisitNotificationsForActor: vi.fn(),
  requireAnyRole: vi.fn(),
  authErrorResponse: vi.fn(),
  createApiLogContext: vi.fn(),
  logApiFailure: vi.fn(),
  logApiStart: vi.fn(),
  logApiSuccess: vi.fn(),
  withRequestId: vi.fn((response: Response) => response),
}));

vi.mock("@nurseconnect/database", () => ({
  db: { tag: "db" },
  withTenantContext: (_db: unknown, _organizationId: string, callback: (tx: unknown) => unknown) => callback(_db),
}));

vi.mock("@nurseconnect/domain-visit", () => ({
  getVisitNotificationsForActor: mocks.getVisitNotificationsForActor,
}));

vi.mock("@/server/auth", () => ({
  authErrorResponse: mocks.authErrorResponse,
  requireAnyRole: mocks.requireAnyRole,
}));

vi.mock("@/server/telemetry/ops-logger", () => ({
  createApiLogContext: mocks.createApiLogContext,
  logApiFailure: mocks.logApiFailure,
  logApiStart: mocks.logApiStart,
  logApiSuccess: mocks.logApiSuccess,
  withRequestId: mocks.withRequestId,
}));

import { GET } from "./route";

describe("GET /api/me/notifications", () => {
  beforeEach(() => {
    mocks.getVisitNotificationsForActor.mockReset();
    mocks.requireAnyRole.mockReset();
    mocks.authErrorResponse.mockReset();
    mocks.createApiLogContext.mockReturnValue({
      requestId: "req-notifications",
      path: "/api/me/notifications",
    });
    mocks.logApiFailure.mockReset();
    mocks.logApiStart.mockReset();
    mocks.logApiSuccess.mockReset();
    mocks.withRequestId.mockClear();
  });

  it("uses the central role resolver for allowed notification actors", async () => {
    mocks.requireAnyRole.mockResolvedValue({
      user: { id: "nurse-1", role: "nurse" },
    });
    mocks.getVisitNotificationsForActor.mockResolvedValue({
      notifications: [{ id: "notification-1" }],
    });

    const response = await GET(new Request("https://app.test/api/me/notifications?limit=10"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([{ id: "notification-1" }]);
    expect(mocks.requireAnyRole).toHaveBeenCalledWith(["admin", "nurse", "patient"]);
    expect(mocks.getVisitNotificationsForActor).toHaveBeenCalledWith(
      { tag: "db" },
      expect.objectContaining({
        actorUserId: "nurse-1",
        actorRole: "nurse",
        limit: 10,
      }),
    );
  });

  it("keeps central auth failures as JSON responses with no-store headers", async () => {
    const authFailure = new Error("Email verification required");
    mocks.requireAnyRole.mockRejectedValue(authFailure);
    mocks.authErrorResponse.mockReturnValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const response = await GET(new Request("https://app.test/api/me/notifications"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(response.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate, max-age=0");
    expect(mocks.authErrorResponse).toHaveBeenCalledWith(
      authFailure,
      expect.objectContaining({ requestId: "req-notifications" }),
      expect.any(Number),
      "notifications",
    );
    expect(mocks.getVisitNotificationsForActor).not.toHaveBeenCalled();
  });

  it("returns central forbidden responses for unsupported roles", async () => {
    const forbidden = new Error("Forbidden");
    mocks.requireAnyRole.mockRejectedValue(forbidden);
    mocks.authErrorResponse.mockReturnValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );

    const response = await GET(new Request("https://app.test/api/me/notifications"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Forbidden" });
    expect(mocks.getVisitNotificationsForActor).not.toHaveBeenCalled();
  });
});
