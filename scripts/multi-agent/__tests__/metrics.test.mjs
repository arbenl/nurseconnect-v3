import { describe, expect, it } from "vitest";

import { calculateMetricsFromEvents } from "../lib/metrics.mjs";

describe("metrics aggregation", () => {
  it("computes success rate, avg/p95 latency, total cost, and quality per dollar", () => {
    const events = [
      {
        type: "lane-complete",
        lane: "preflight-agent",
        status: "pass",
        durationMs: 100,
        costUsd: 0.4,
      },
      {
        type: "lane-complete",
        lane: "testing-agent",
        status: "pass",
        durationMs: 300,
        costUsd: 1.2,
      },
      {
        type: "lane-complete",
        lane: "verification-agent",
        status: "fail",
        durationMs: 500,
        costUsd: 2.4,
      },
      {
        type: "debug",
        message: "ignored event",
      },
    ];

    const metrics = calculateMetricsFromEvents(events);

    expect(metrics.successRate).toBeCloseTo(2 / 3, 4);
    expect(metrics.avgLatencyMs).toBeCloseTo((100 + 300 + 500) / 3, 4);
    expect(metrics.p95LatencyMs).toBe(500);
    expect(metrics.totalCostUsd).toBeCloseTo(4.0, 4);
    expect(metrics.qualityPerDollar).toBeCloseTo((2 / 3) / 4.0, 4);
  });

  it("returns zeroed metrics when no lane completion events are present", () => {
    const metrics = calculateMetricsFromEvents([{ type: "run-start" }]);

    expect(metrics).toEqual({
      successRate: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      totalCostUsd: 0,
      qualityPerDollar: 0,
      laneCount: 0,
    });
  });
});
