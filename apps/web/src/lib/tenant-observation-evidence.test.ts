import { describe, expect, it } from "vitest";

import { parseTenantObservationEvidence } from "./tenant-observation-evidence";

const line = (value: Record<string, unknown>) => JSON.stringify({ v: 1, run: "run-one", ...value });

describe("tenant observation evidence", () => {
  it("aggregates interleaved observer instances", () => {
    const evidence = [
      line({ instance: "one", type: "ready" }),
      line({ instance: "two", type: "ready" }),
      line({ instance: "two", type: "tracked_query_seen" }),
      line({ instance: "one", type: "tracked_query_seen" }),
    ].join("\n");

    expect(parseTenantObservationEvidence(evidence, "run-one")).toEqual({
      instances: 2,
      readyRecords: 2,
      trackedQueryRecords: 2,
      violationCount: 0,
    });
  });

  it.each([
    ["missing", ""],
    ["malformed", "{"],
    ["wrong run", line({ instance: "one", run: "other", type: "ready" })],
    ["missing ready", line({ instance: "one", type: "tracked_query_seen" })],
    ["missing liveness", line({ instance: "one", type: "ready" })],
  ])("fails closed for %s evidence", (_label, evidence) => {
    expect(() => parseTenantObservationEvidence(evidence, "run-one")).toThrow();
  });

  it("counts controlled violations exactly", () => {
    const evidence = [
      line({ instance: "one", type: "ready" }),
      line({ instance: "one", type: "tracked_query_seen" }),
      line({ instance: "one", type: "violation" }),
    ].join("\n");

    expect(parseTenantObservationEvidence(evidence, "run-one").violationCount).toBe(1);
  });

  it("allows an explicit public-only run without a tracked tenant query", () => {
    expect(parseTenantObservationEvidence("", "run-one", {
      allowInactiveObserver: true,
      requireTrackedQuery: false,
    })).toEqual({ instances: 0, readyRecords: 0, trackedQueryRecords: 0, violationCount: 0 });
  });
});
