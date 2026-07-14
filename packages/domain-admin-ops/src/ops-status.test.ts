import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DbClient } from "@nurseconnect/database";

const databaseMock = vi.hoisted(() => ({
  execute: vi.fn(),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings: Array.from(strings),
    values,
  })),
}));

vi.mock("@nurseconnect/database", () => ({
  db: {
    execute: databaseMock.execute,
  },
  sql: databaseMock.sql,
}));

import {
  getAdminOpsStatus,
  getLaunchNurseSupplySummary,
} from "./ops-status";

describe("ops status launch supply query", () => {
  beforeEach(() => {
    databaseMock.execute.mockReset();
    databaseMock.sql.mockClear();
  });

  it("uses the injected timestamp when summarizing launch nurse supply", async () => {
    const now = new Date("2026-04-25T10:00:00.000Z");
    databaseMock.execute.mockResolvedValueOnce({
      rows: [
        {
          verifiedAndAvailable: "12",
          launchServiceAreaCount: "2",
          launchLowestServiceAreaSupply: "10",
          launchServiceAreasBelowMinimum: "0",
        },
      ],
    });

    await expect(getLaunchNurseSupplySummary(databaseMock as unknown as DbClient, now)).resolves.toEqual({
      verifiedAndAvailable: 12,
      launchMinimum: 10,
      launchShortfall: 0,
      launchReady: true,
      launchServiceAreaCount: 2,
      launchLowestServiceAreaSupply: 10,
      launchServiceAreasBelowMinimum: 0,
    });
    expect(databaseMock.execute).toHaveBeenCalledTimes(1);
    expect(databaseMock.sql.mock.calls[0]?.[1]).toBe(now);
  });

  it("builds admin ops status from the service-area-aware nurse supply summary", async () => {
    const now = new Date("2026-04-25T10:00:00.000Z");
    databaseMock.execute
      .mockResolvedValueOnce({ rows: [{ active: "1" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            verifiedAndAvailable: "8",
            launchServiceAreaCount: "1",
            launchLowestServiceAreaSupply: "8",
            launchServiceAreasBelowMinimum: "1",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            unassigned: "2",
            staleAssigned: "1",
            staleEnroute: "0",
            exceptionQueue: "1",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            authorizationsWithoutPayout: "1",
            recentFailedAuthorizations: "0",
            recentFailedPayouts: "0",
          },
        ],
      });

    await expect(getAdminOpsStatus(databaseMock as unknown as DbClient, { now })).resolves.toMatchObject({
      generatedAt: now.toISOString(),
      serviceAreas: { active: 1 },
      nurseSupply: {
        verifiedAndAvailable: 8,
        launchMinimum: 10,
        launchShortfall: 2,
        launchReady: false,
        launchServiceAreaCount: 1,
        launchLowestServiceAreaSupply: 8,
        launchServiceAreasBelowMinimum: 1,
      },
      requests: {
        unassigned: 2,
        staleAssigned: 1,
        staleEnroute: 0,
        exceptionQueue: 1,
      },
      payments: {
        authorizationsWithoutPayout: 1,
        recentFailedAuthorizations: 0,
        recentFailedPayouts: 0,
      },
    });
    expect(databaseMock.execute).toHaveBeenCalledTimes(4);
  });
});
