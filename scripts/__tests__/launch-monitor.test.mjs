import { afterEach, describe, expect, it, vi } from "vitest";

import {
  collectSample,
  evaluateOpsStatus,
  parseArgs,
} from "../launch-monitor.mjs";

describe("launch-monitor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses the admin ops requirement flag", () => {
    expect(parseArgs(["--require-admin-ops"]).requireAdminOps).toBe(true);
  });

  it("fails closed when admin ops status is skipped but required", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            ok: true,
            db: "ok",
            serviceAreas: { active: 1 },
            nurseSupply: { verifiedAndAvailable: 1 },
          }),
      })),
    );

    const sample = await collectSample(
      {
        baseUrl: "https://example.test",
        timeoutMs: 100,
        adminCookie: "",
        requireAdminOps: true,
      },
      1,
    );

    expect(sample.failures).toContain(
      "ops: admin ops status required but no admin cookie was provided",
    );
  });

  it("rejects malformed launch threshold fields", () => {
    const result = evaluateOpsStatus({
      ok: true,
      status: 200,
      body: {
        db: "ok",
        serviceAreas: { active: 1 },
        nurseSupply: {
          verifiedAndAvailable: "n/a",
          launchMinimum: 10,
          launchShortfall: "n/a",
          launchReady: true,
          launchServiceAreasBelowMinimum: "n/a",
        },
        requests: {},
        payments: {},
      },
    });

    expect(result.failures).toEqual(
      expect.arrayContaining([
        "ops status verified and available nurse supply is missing or invalid",
        "ops status launch shortfall is missing or invalid",
        "ops status service-area threshold count is missing or invalid",
      ]),
    );
  });

  it("requires the service-area-aware launchReady flag", () => {
    const result = evaluateOpsStatus({
      ok: true,
      status: 200,
      body: {
        db: "ok",
        serviceAreas: { active: 2 },
        nurseSupply: {
          verifiedAndAvailable: 10,
          launchMinimum: 10,
          launchShortfall: 10,
          launchReady: false,
          launchServiceAreasBelowMinimum: 1,
        },
        requests: {},
        payments: {},
      },
    });

    expect(result.failures).toEqual(
      expect.arrayContaining([
        "ops status nurse launch supply is not ready",
        "ops status has active service areas below launch minimum (1)",
      ]),
    );
  });
});
