import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dbExecute: vi.fn(),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings: Array.from(strings),
    values,
  })),
  getAdminOpsStatus: vi.fn(),
  requireRole: vi.fn(),
  authErrorResponse: vi.fn(),
  createApiLogContext: vi.fn(),
  logApiFailure: vi.fn(),
  logApiStart: vi.fn(),
  logApiSuccess: vi.fn(),
  withRequestId: vi.fn((response: Response) => response),
}));

vi.mock("@nurseconnect/database", () => ({
  db: { execute: mocks.dbExecute },
  sql: mocks.sql,
}));

vi.mock("@nurseconnect/domain-admin-ops", () => ({
  LAUNCH_MINIMUM_VERIFIED_AVAILABLE_NURSES: 10,
  getAdminOpsStatus: mocks.getAdminOpsStatus,
}));

vi.mock("@/server/auth", () => ({
  authErrorResponse: mocks.authErrorResponse,
  requireRole: mocks.requireRole,
}));

vi.mock("@/server/telemetry/ops-logger", () => ({
  createApiLogContext: mocks.createApiLogContext,
  logApiFailure: mocks.logApiFailure,
  logApiStart: mocks.logApiStart,
  logApiSuccess: mocks.logApiSuccess,
  withRequestId: mocks.withRequestId,
}));

import { GET } from "./route";

describe("GET /api/admin/ops/status", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-04-25T10:00:00.000Z"));
    mocks.dbExecute.mockReset();
    mocks.getAdminOpsStatus.mockReset();
    mocks.requireRole.mockReset();
    mocks.authErrorResponse.mockReset();
    mocks.createApiLogContext.mockReturnValue({
      requestId: "req-123",
      path: "/api/admin/ops/status",
    });
    mocks.logApiFailure.mockReset();
    mocks.logApiStart.mockReset();
    mocks.logApiSuccess.mockReset();
    mocks.withRequestId.mockClear();
  });

  it("returns status counts with launch supply fields when the database is healthy", async () => {
    mocks.requireRole.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    mocks.dbExecute.mockResolvedValueOnce({ rows: [{ ok: 1 }] });
    mocks.getAdminOpsStatus.mockResolvedValue({
      generatedAt: "2026-04-25T10:00:00.000Z",
      serviceAreas: { active: 1 },
      nurseSupply: {
        verifiedAndAvailable: 10,
        launchMinimum: 10,
        launchShortfall: 0,
        launchReady: true,
        launchServiceAreaCount: 1,
        launchLowestServiceAreaSupply: 10,
        launchServiceAreasBelowMinimum: 0,
      },
      requests: {
        unassigned: 0,
        staleAssigned: 0,
        staleEnroute: 0,
        exceptionQueue: 0,
      },
      payments: {
        authorizationsWithoutPayout: 0,
        recentFailedAuthorizations: 0,
        recentFailedPayouts: 0,
      },
    });

    const response = await GET(new Request("https://app.test/api/admin/ops/status"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.db).toBe("ok");
    expect(body.nurseSupply).toMatchObject({
      launchMinimum: 10,
      launchShortfall: 0,
      launchReady: true,
      launchLowestServiceAreaSupply: 10,
    });
    expect(mocks.logApiSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "admin-1", actorRole: "admin" }),
      200,
      expect.any(Number),
      expect.objectContaining({ source: "admin.ops.status" }),
    );
  });

  it("returns the launch-threshold fallback body when the database probe fails", async () => {
    mocks.requireRole.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    });
    mocks.dbExecute.mockRejectedValueOnce(new Error("db down"));

    const response = await GET(new Request("https://app.test/api/admin/ops/status"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      db: "error",
      serviceAreas: { active: 0 },
      nurseSupply: {
        verifiedAndAvailable: 0,
        launchMinimum: 10,
        launchShortfall: 10,
        launchReady: false,
        launchServiceAreaCount: 0,
        launchLowestServiceAreaSupply: 0,
        launchServiceAreasBelowMinimum: 0,
      },
    });
    expect(mocks.getAdminOpsStatus).not.toHaveBeenCalled();
    expect(mocks.logApiFailure).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "admin-1", actorRole: "admin" }),
      expect.any(Error),
      500,
      expect.any(Number),
      expect.objectContaining({ subsystem: "db" }),
    );
  });
});
